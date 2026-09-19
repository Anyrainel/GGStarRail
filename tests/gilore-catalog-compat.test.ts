import { afterEach, describe, expect, it, vi } from "vitest";
import websiteManifest from "@/data/game/manifest.json";

const mockedModuleIds = [
  "@/data/game/manifest.json",
  "@/data/gameDataLoader",
  "@/providers/gilore/assets",
] as const;

afterEach(() => {
  for (const moduleId of mockedModuleIds) vi.doUnmock(moduleId);
  vi.resetModules();
});

function mockMember(schemaVersion: string, collection?: string) {
  vi.doMock("@/data/game/manifest.json", () => ({ default: websiteManifest }));
  vi.doMock("@/data/gameDataLoader", () => ({
    loadGameMember: async (member: string) => ({
      schema_version: schemaVersion,
      collection: collection ?? member,
      value: [],
    }),
  }));
  vi.doMock("@/providers/gilore/assets", () => ({
    loadCatalogAssetLookup: vi.fn(async () => new Map()),
  }));
}

describe("current GIlore runtime schema boundary", () => {
  it.each([
    "1.0.0",
    "1.1.0",
    "1.2.0",
    "1.3.0",
  ])("rejects an obsolete %s runtime manifest", async (schemaVersion) => {
    vi.doMock("@/data/game/manifest.json", () => ({
      default: {
        ...websiteManifest,
        reference_manifest: {
          ...websiteManifest.reference_manifest,
          schema_version: schemaVersion,
        },
      },
    }));
    await expect(import("@/providers/gilore/catalog")).rejects.toThrow();
  });

  it.each([
    "loadCharacters",
    "loadLightCones",
    "loadProgression",
    "loadPropertyTables",
  ] as const)("rejects obsolete members at %s", async (load) => {
    mockMember("1.3.0");
    const catalog = await import("@/providers/gilore/catalog");
    await expect(catalog[load]()).rejects.toThrow(/Invalid .* catalog schema/);
  });

  it("rejects mismatched member identities even with the current schema", async () => {
    mockMember("2.0.0", "light_cones");
    const catalog = await import("@/providers/gilore/catalog");
    await expect(catalog.loadCharacters()).rejects.toThrow(
      "Invalid characters catalog schema"
    );
  });

  it("rejects obsolete Currency War members", async () => {
    mockMember("1.3.0");
    const { loadCurrencyWarCatalog } = await import(
      "@/providers/gilore/currencyWar"
    );
    await expect(loadCurrencyWarCatalog()).rejects.toThrow(
      "Invalid Currency War catalog"
    );
  });

  it("accepts the current schema with one clean catalog shape", async () => {
    mockMember("2.0.0");
    const catalog = await import("@/providers/gilore/catalog");
    const characters = await catalog.loadCharacters();
    expect(characters.schemaVersion).toBe("2.0.0");
    expect(characters.values).toEqual([]);
    expect(characters.byId.size).toBe(0);
    expect(catalog.HSR_REFERENCE_REVISION).toBe(
      websiteManifest.source_revision
    );
  });
});
