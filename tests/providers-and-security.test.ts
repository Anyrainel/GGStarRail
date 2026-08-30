import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseGIloreManifest } from "@/providers/gilore/manifest";
import {
  EphemeralAuthMaterial,
  importFromHoYoLab,
} from "@/providers/hoyolab/ephemeralAuth";
import { parseScannerExport } from "@/providers/scanner/schema";
import { PROVIDER_REGISTRY } from "@/providers/types";
import { makeAccountSnapshot } from "./fixtures";

const credentialMarker = "ltoken=VERY_PRIVATE_MARKER_2026";

describe("provider and credential boundaries", () => {
  it("accepts only an HSR, bilingual, version-1 GIlore manifest", () => {
    const manifest = {
      format: "ggstarrail-data",
      schemaVersion: 1,
      game: "honkai-star-rail",
      provider: "gilore",
      locales: ["en", "zh-CN"],
      provenance: {
        repository: "https://example.com/independent-hsr-data",
        revision: "abcdef1234567890",
        extractorVersion: "0.1.0",
        generatedAt: "2026-08-30T00:00:00.000Z",
        license: "review-required",
      },
      datasets: [
        {
          id: "characters",
          version: "1",
          recordCount: 0,
          checksum: `sha256:${"a".repeat(64)}`,
        },
      ],
    } as const;
    expect(parseGIloreManifest(manifest).locales).toEqual(["en", "zh-CN"]);
    expect(() =>
      parseGIloreManifest({ ...manifest, schemaVersion: 2 })
    ).toThrow();
    expect(() =>
      parseGIloreManifest({ ...manifest, game: "genshin" })
    ).toThrow();
  });

  it("parses the GGStarRail scanner envelope and rejects credential fields", () => {
    const input = {
      format: "ggstarrail-scanner-export",
      schemaVersion: 1,
      sourceApp: { name: "FutureScanner", version: "0.1.0" },
      exportedAt: "2026-08-30T00:00:00.000Z",
      account: makeAccountSnapshot(),
    };
    expect(parseScannerExport(input).account.profileId).toBe("profile:local");
    expect(() =>
      parseScannerExport({ ...input, accountCookie: credentialMarker })
    ).toThrow(/Sensitive field/);
  });

  it("keeps provider IDs unique", () => {
    const ids = PROVIDER_REGISTRY.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses credential material once, clears it, and exposes only a safe error", async () => {
    const auth = new EphemeralAuthMaterial(credentialMarker);
    const transport = vi.fn(async () => {
      throw new Error(`network failed ${credentialMarker}`);
    });
    const error = await importFromHoYoLab(
      { uid: "600000001", region: "prod_official_usa", auth },
      transport
    ).catch((reason: unknown) => reason);

    expect(transport).toHaveBeenCalledOnce();
    expect(String(error)).toContain("HOYOLAB_IMPORT_FAILED");
    expect(String(error)).not.toContain(credentialMarker);
    expect(JSON.stringify(auth)).toBe('"[REDACTED]"');
    await expect(auth.consumeOnce(async () => "nope")).rejects.toThrow(
      /cleared/
    );
    expect(JSON.stringify(localStorage)).not.toContain(credentialMarker);
  });

  it("prevents persisted modules from importing ephemeral credentials", () => {
    const forbiddenModules = [
      path.resolve("src/stores"),
      path.resolve("src/lib/backup.ts"),
    ];
    const violations: string[] = [];
    for (const target of forbiddenModules) {
      const files = fs.statSync(target).isDirectory()
        ? fs
            .readdirSync(target, { recursive: true })
            .map(String)
            .filter((file) => /\.(ts|tsx)$/.test(file))
            .map((file) => path.join(target, file))
        : [target];
      for (const file of files) {
        const source = fs.readFileSync(file, "utf8");
        if (source.includes("providers/hoyolab")) violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("contains no storage or logging call in the HoYoLAB provider", () => {
    const source = fs.readFileSync(
      path.resolve("src/providers/hoyolab/ephemeralAuth.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(source).not.toMatch(/console\.(log|info|warn|error)/);
  });
});
