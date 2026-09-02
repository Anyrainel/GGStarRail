import { describe, expect, it } from "vitest";
import {
  applyAccountImport,
  resolveAccountImportIdentity,
} from "@/domain/account/merge";
import type { AccountSnapshot } from "@/domain/account/schemas";
import { makeAccountSnapshot, makeRelic } from "./fixtures";

function showcaseAccount(): AccountSnapshot {
  const current = makeAccountSnapshot();
  const characterKey = "account:600000001:character:character:trailblazer";
  const lightConeKey = "account:600000001:light-cone:character:trailblazer";
  const relicKey = "account:600000001:relic:character:trailblazer:head";
  return {
    ...current,
    profileId: "account:600000001",
    characters: current.characters.map((character) => ({
      ...character,
      key: characterKey,
      lightConeKey,
      relicKeys: [relicKey],
    })),
    lightCones: current.lightCones.map((lightCone) => ({
      ...lightCone,
      key: lightConeKey,
      locked: null,
      equippedCharacterKey: characterKey,
    })),
    relics: [
      makeRelic({
        key: relicKey,
        locked: null,
        discarded: null,
        equippedCharacterKey: characterKey,
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
    expect(merged.lightCones).toHaveLength(1);
    expect(merged.lightCones[0]).toMatchObject({
      key: "light-cone:1",
      locked: true,
      equippedCharacterKey: "character:1",
    });
    expect(merged.relics).toHaveLength(1);
    expect(merged.relics[0]?.key).toBe("relic:1");
    expect(merged.relics[0]?.locked).toBe(false);
    expect(merged.relics[0]?.discarded).toBe(false);
    expect(merged.relics[0]?.equippedCharacterKey).toBe("character:1");
    expect(merged.source.warnings).toContain(
      "PARTIAL_IMPORT_MERGED_WITH_LOCAL_DATA"
    );
  });

  it("preserves changed equipped items and assigns incoming gear distinct state", () => {
    const current = makeAccountSnapshot();
    const incoming = showcaseAccount();
    const incomingCharacter = incoming.characters[0]!;

    incoming.lightCones[0] = {
      ...incoming.lightCones[0]!,
      key: "light-cone:1",
      definitionId: "light-cone:changed",
      level: 70,
      ascension: 5,
      superimposition: 2,
      locked: null,
    };
    incoming.relics[0] = makeRelic({
      key: "relic:1",
      definitionId: "relic-definition:changed",
      setId: "relic-set:changed",
      level: 6,
      mainStat: { statId: "hp", value: 289 },
      substats: [{ statId: "speed", value: 2.3 }],
      locked: null,
      discarded: null,
      equippedCharacterKey: incomingCharacter.key,
    });
    incomingCharacter.lightConeKey = "light-cone:1";
    incomingCharacter.relicKeys = ["relic:1"];

    const merged = applyAccountImport(current, incoming, "merge");
    const oldLightCone = merged.lightCones.find(
      (lightCone) => lightCone.key === "light-cone:1"
    );
    const newLightCone = merged.lightCones.find(
      (lightCone) => lightCone.definitionId === "light-cone:changed"
    );
    const oldRelic = merged.relics.find((relic) => relic.key === "relic:1");
    const newRelic = merged.relics.find(
      (relic) => relic.definitionId === "relic-definition:changed"
    );

    expect(merged.lightCones).toHaveLength(2);
    expect(oldLightCone).toMatchObject({ key: "light-cone:1", locked: true });
    expect(oldLightCone?.equippedCharacterKey).toBeUndefined();
    expect(newLightCone).toMatchObject({
      key: "light-cone:1:merge:1",
      locked: null,
      equippedCharacterKey: "character:1",
    });
    expect(merged.relics).toHaveLength(2);
    expect(oldRelic).toMatchObject({
      key: "relic:1",
      locked: false,
      discarded: false,
    });
    expect(oldRelic?.equippedCharacterKey).toBeUndefined();
    expect(newRelic).toMatchObject({
      key: "relic:1:merge:1",
      locked: null,
      discarded: null,
      equippedCharacterKey: "character:1",
    });
    expect(merged.characters[0]).toMatchObject({
      lightConeKey: newLightCone?.key,
      relicKeys: [newRelic?.key],
    });
    expect(
      merged.lightCones.filter(
        (lightCone) => lightCone.equippedCharacterKey === "character:1"
      )
    ).toHaveLength(1);
    expect(
      merged.relics.filter(
        (relic) =>
          relic.equippedCharacterKey === "character:1" && relic.slot === "head"
      )
    ).toHaveLength(1);
    expect(merged.source.coverage).toEqual(incoming.source.coverage);
  });

  it("allocates stable safe keys when distinct incoming keys collide with inventory", () => {
    const current = makeAccountSnapshot();
    current.lightCones.push({
      ...current.lightCones[0]!,
      key: "partial:light-cone",
      definitionId: "light-cone:unrelated",
      locked: false,
      equippedCharacterKey: undefined,
    });
    current.relics.push(
      makeRelic({
        key: "partial:relic",
        definitionId: "relic-definition:unrelated",
        setId: "relic-set:unrelated",
        slot: "body",
        locked: true,
        discarded: true,
      })
    );
    const incoming = showcaseAccount();
    incoming.lightCones[0] = {
      ...incoming.lightCones[0]!,
      key: "partial:light-cone",
      definitionId: "light-cone:changed",
      locked: null,
    };
    incoming.relics[0] = makeRelic({
      key: "partial:relic",
      definitionId: "relic-definition:changed",
      setId: "relic-set:changed",
      level: 6,
      mainStat: { statId: "hp", value: 289 },
      locked: null,
      discarded: null,
      equippedCharacterKey: incoming.characters[0]!.key,
    });
    incoming.characters[0]!.lightConeKey = "partial:light-cone";
    incoming.characters[0]!.relicKeys = ["partial:relic"];

    const merged = applyAccountImport(current, incoming, "merge");
    const equippedLightCone = merged.lightCones.find(
      (lightCone) => lightCone.equippedCharacterKey === "character:1"
    );
    const equippedRelic = merged.relics.find(
      (relic) => relic.equippedCharacterKey === "character:1"
    );
    expect(equippedLightCone).toMatchObject({
      key: "partial:light-cone:merge:1",
      locked: null,
    });
    expect(equippedRelic).toMatchObject({
      key: "partial:relic:merge:1",
      locked: null,
      discarded: null,
    });
    expect(
      merged.lightCones.find(
        (lightCone) => lightCone.key === "partial:light-cone"
      )
    ).toMatchObject({ definitionId: "light-cone:unrelated", locked: false });
    expect(
      merged.relics.find((relic) => relic.key === "partial:relic")
    ).toMatchObject({
      definitionId: "relic-definition:unrelated",
      locked: true,
      discarded: true,
    });

    const repeated = applyAccountImport(merged, incoming, "merge");
    expect(repeated.lightCones).toHaveLength(3);
    expect(repeated.relics).toHaveLength(3);
    expect(
      repeated.lightCones.find(
        (lightCone) => lightCone.equippedCharacterKey === "character:1"
      )?.key
    ).toBe("partial:light-cone:merge:1");
    expect(
      repeated.relics.find(
        (relic) => relic.equippedCharacterKey === "character:1"
      )?.key
    ).toBe("partial:relic:merge:1");
  });

  it("does not guess between duplicate visible identities during a key collision", () => {
    const current = makeAccountSnapshot();
    current.lightCones.push(
      {
        ...current.lightCones[0]!,
        key: "light-cone:duplicate:1",
        definitionId: "light-cone:incoming",
        locked: false,
        equippedCharacterKey: undefined,
      },
      {
        ...current.lightCones[0]!,
        key: "light-cone:duplicate:2",
        definitionId: "light-cone:incoming",
        locked: true,
        equippedCharacterKey: undefined,
      }
    );
    current.relics.push(
      makeRelic({
        key: "relic:duplicate:1",
        definitionId: "relic-definition:incoming",
        locked: false,
        discarded: false,
      }),
      makeRelic({
        key: "relic:duplicate:2",
        definitionId: "relic-definition:incoming",
        locked: true,
        discarded: true,
      })
    );
    const incoming = showcaseAccount();
    incoming.lightCones[0] = {
      ...current.lightCones[1]!,
      key: "light-cone:1",
      locked: null,
      equippedCharacterKey: incoming.characters[0]!.key,
    };
    incoming.relics[0] = {
      ...current.relics[1]!,
      key: "relic:1",
      locked: null,
      discarded: null,
      equippedCharacterKey: incoming.characters[0]!.key,
    };
    incoming.characters[0]!.lightConeKey = "light-cone:1";
    incoming.characters[0]!.relicKeys = ["relic:1"];

    const merged = applyAccountImport(current, incoming, "merge");
    const equippedLightCone = merged.lightCones.find(
      (lightCone) => lightCone.equippedCharacterKey === "character:1"
    );
    const equippedRelic = merged.relics.find(
      (relic) => relic.equippedCharacterKey === "character:1"
    );

    expect(merged.lightCones).toHaveLength(4);
    expect(equippedLightCone).toMatchObject({
      key: "light-cone:1:merge:1",
      locked: null,
    });
    expect(merged.relics).toHaveLength(4);
    expect(equippedRelic).toMatchObject({
      key: "relic:1:merge:1",
      locked: null,
      discarded: null,
    });
    expect(
      merged.lightCones.filter((lightCone) => lightCone.equippedCharacterKey)
    ).toHaveLength(1);
    expect(
      merged.relics.filter((relic) => relic.equippedCharacterKey)
    ).toHaveLength(1);

    const exactIdentityIncoming = showcaseAccount();
    exactIdentityIncoming.lightCones[0] = {
      ...current.lightCones[1]!,
      key: "light-cone:duplicate:1",
      locked: null,
      equippedCharacterKey: exactIdentityIncoming.characters[0]!.key,
    };
    exactIdentityIncoming.relics[0] = {
      ...current.relics[1]!,
      key: "relic:duplicate:1",
      locked: null,
      discarded: null,
      equippedCharacterKey: exactIdentityIncoming.characters[0]!.key,
    };
    exactIdentityIncoming.characters[0]!.lightConeKey =
      "light-cone:duplicate:1";
    exactIdentityIncoming.characters[0]!.relicKeys = ["relic:duplicate:1"];

    const reconciled = applyAccountImport(
      merged,
      exactIdentityIncoming,
      "merge"
    );
    expect(reconciled.lightCones).toHaveLength(4);
    expect(
      reconciled.lightCones.find(
        (lightCone) => lightCone.equippedCharacterKey === "character:1"
      )
    ).toMatchObject({ key: "light-cone:duplicate:1", locked: false });
    expect(reconciled.relics).toHaveLength(4);
    expect(
      reconciled.relics.find(
        (relic) => relic.equippedCharacterKey === "character:1"
      )
    ).toMatchObject({
      key: "relic:duplicate:1",
      locked: false,
      discarded: false,
    });
  });

  it("requires replacement for two known different UIDs", () => {
    const incoming = {
      ...showcaseAccount(),
      uid: "700000001",
      profileId: "account:700000001",
      characters: showcaseAccount().characters.map((character) => ({
        ...character,
        key: character.key.replace("600000001", "700000001"),
        lightConeKey: character.lightConeKey?.replace("600000001", "700000001"),
        relicKeys: character.relicKeys.map((key) =>
          key.replace("600000001", "700000001")
        ),
      })),
      lightCones: showcaseAccount().lightCones.map((lightCone) => ({
        ...lightCone,
        key: lightCone.key.replace("600000001", "700000001"),
        equippedCharacterKey: lightCone.equippedCharacterKey?.replace(
          "600000001",
          "700000001"
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
