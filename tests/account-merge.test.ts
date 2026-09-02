import { describe, expect, it } from "vitest";
import {
  applyAccountImport,
  resolveAccountImportIdentity,
} from "@/domain/account/merge";
import type { AccountSnapshot } from "@/domain/account/schemas";
import { makeAccountSnapshot, makeRelic } from "./fixtures";

function showcaseAccount(): AccountSnapshot {
  const current = makeAccountSnapshot();
  return {
    ...current,
    profileId: "account:600000001",
    characters: current.characters.map((character) => ({
      ...character,
      key: "account:600000001:character:character:trailblazer",
      lightConeKey: undefined,
      relicKeys: ["account:600000001:relic:character:trailblazer:head"],
    })),
    lightCones: [],
    relics: [
      makeRelic({
        key: "account:600000001:relic:character:trailblazer:head",
        locked: null,
        discarded: null,
        equippedCharacterKey:
          "account:600000001:character:character:trailblazer",
      }),
    ],
    source: {
      provider: "uid-showcase",
      formatVersion: 1,
      sourceVersion: "enka-hsr-raw",
      importedAt: "2026-09-02T00:00:00.000Z",
      coverage: {
        characters: "showcase-only",
        lightCones: "showcase-only",
        relics: "showcase-only",
      },
      warnings: ["SHOWCASE_ONLY"],
    },
  };
}

describe("source-aware account merging", () => {
  it("upserts showcase equipment without discarding scanner state or identity", () => {
    const current = makeAccountSnapshot();
    expect(resolveAccountImportIdentity(current, showcaseAccount())).toBe(
      "same-uid"
    );
    const merged = applyAccountImport(current, showcaseAccount(), "merge");
    expect(merged.characters).toHaveLength(1);
    expect(merged.characters[0]?.key).toBe("character:1");
    expect(merged.relics).toHaveLength(1);
    expect(merged.relics[0]?.key).toBe("relic:1");
    expect(merged.relics[0]?.locked).toBe(false);
    expect(merged.relics[0]?.discarded).toBe(false);
    expect(merged.relics[0]?.equippedCharacterKey).toBe("character:1");
    expect(merged.source.warnings).toContain(
      "PARTIAL_IMPORT_MERGED_WITH_LOCAL_DATA"
    );
  });

  it("requires replacement for two known different UIDs", () => {
    const incoming = {
      ...showcaseAccount(),
      uid: "700000001",
      profileId: "account:700000001",
      characters: showcaseAccount().characters.map((character) => ({
        ...character,
        key: character.key.replace("600000001", "700000001"),
        relicKeys: character.relicKeys.map((key) =>
          key.replace("600000001", "700000001")
        ),
      })),
      relics: showcaseAccount().relics.map((relic) => ({
        ...relic,
        key: relic.key.replace("600000001", "700000001"),
        equippedCharacterKey: relic.equippedCharacterKey?.replace(
          "600000001",
          "700000001"
        ),
      })),
    };
    expect(resolveAccountImportIdentity(makeAccountSnapshot(), incoming)).toBe(
      "different-uid"
    );
    expect(() =>
      applyAccountImport(makeAccountSnapshot(), incoming, "merge")
    ).toThrow("ACCOUNT_IMPORT_DIFFERENT_UID_REQUIRES_REPLACEMENT");
    const merged = applyAccountImport(
      makeAccountSnapshot(),
      incoming,
      "replace"
    );
    expect(merged.profileId).toBe("account:700000001");
    expect(merged.relics[0]?.key).toContain("700000001");
    expect(merged.source.warnings).not.toContain(
      "PARTIAL_IMPORT_MERGED_WITH_LOCAL_DATA"
    );
  });

  it("marks UID-less to known imports unknown until the caller chooses", () => {
    const uidless = {
      ...makeAccountSnapshot(),
      profileId: "demo-account:v2",
      uid: undefined,
      region: undefined,
    };
    const incoming = showcaseAccount();
    expect(resolveAccountImportIdentity(uidless, incoming)).toBe(
      "unknown-identity"
    );

    const replaced = applyAccountImport(uidless, incoming, "replace");
    expect(replaced.profileId).toBe("account:600000001");
    expect(replaced.uid).toBe("600000001");

    const explicitlyMerged = applyAccountImport(uidless, incoming, "merge");
    expect(explicitlyMerged.profileId).toBe("demo-account:v2");
    expect(explicitlyMerged.uid).toBe("600000001");
    expect(explicitlyMerged.source.warnings).toContain(
      "PARTIAL_IMPORT_MERGED_WITH_LOCAL_DATA"
    );
  });
});
