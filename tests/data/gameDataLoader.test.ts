import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";

beforeEach(() => vi.resetModules());

describe("published game transport", () => {
  it("fetches only the requested released member and no beta assets by default", async () => {
    const { loadGameMember } = await import("@/data/gameDataLoader");
    const value = await loadGameMember("characters");
    expect(value).toHaveProperty("schema_version", "1.2.0");
    const requests = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(requests).toHaveLength(3);
    expect(
      requests.every((url) => /characters_(stats|en|zh)\.json/.test(url))
    ).toBe(true);
    expect(requests.some((url) => url.includes("beta"))).toBe(false);
  });

  it("shares concurrent loads and keeps beta requests behind explicit opt-in", async () => {
    const { loadGameMember, isBetaEntity } = await import(
      "@/data/gameDataLoader"
    );
    const released = (await loadGameMember("characters")) as {
      value: { id: string }[];
    };
    const requestCount = vi.mocked(fetch).mock.calls.length;
    const [first, second] = await Promise.all([
      loadGameMember("characters"),
      loadGameMember("characters"),
    ]);
    expect(first).toBe(second);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(requestCount);
    localStorage.setItem(STORAGE_KEYS.beta, "true");
    const full = (await loadGameMember("characters")) as {
      value: { id: string }[];
    };
    expect(full.value.length).toBeGreaterThanOrEqual(released.value.length);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) =>
          String(url).includes("characters_beta_stats")
        )
    ).toBe(true);
    for (const character of released.value)
      expect(isBetaEntity("characters", character.id)).toBe(false);
    const officialIds = new Set(released.value.map((entry) => entry.id));
    for (const character of full.value.filter(
      (entry) => !officialIds.has(entry.id)
    )) {
      expect(isBetaEntity("characters", character.id)).toBe(true);
    }
  });

  it("can retry after a failed asset request", async () => {
    const readPublishedAsset = vi.mocked(fetch).getMockImplementation();
    if (!readPublishedAsset) throw new Error("Missing fixture transport");
    vi.mocked(fetch).mockImplementationOnce(
      async () => new Response("unavailable", { status: 503 })
    );
    const { loadGameMember } = await import("@/data/gameDataLoader");
    await expect(loadGameMember("characters")).rejects.toThrow("503");
    vi.mocked(fetch).mockImplementation(readPublishedAsset);
    await expect(loadGameMember("characters")).resolves.toHaveProperty("value");
  });

  it("matches published released counts and keeps enhancements outside default data", async () => {
    const manifest = JSON.parse(
      await readFile(path.resolve("src/data/game/manifest.json"), "utf8")
    );
    const { loadGameMember } = await import("@/data/gameDataLoader");
    const characters = (await loadGameMember("characters")) as {
      value: { enhancements: unknown[] }[];
    };
    expect(characters.value).toHaveLength(
      manifest.reference_manifest.counts.characters
    );
    expect(
      characters.value.every((entry) => entry.enhancements.length === 0)
    ).toBe(true);
    expect(characters.value.length).toBeGreaterThan(0);
  });
});
