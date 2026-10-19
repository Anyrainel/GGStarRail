import { afterEach, describe, expect, it } from "vitest";
import { BUILD_SLOT_ORDER } from "@/domain/build/evaluation";
import {
  availableRecommendationBuilds,
  equipRecommendedRelics,
  recommendCharacterEquipment,
} from "@/domain/build/recommendations";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import type { RelicScoringContext } from "@/domain/build/scoring";
import {
  type AccountSnapshot,
  AccountSnapshotSchema,
  type Relic,
  type RelicSlot,
} from "@/domain/game-account/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const mains: Record<RelicSlot, string> = {
  head: "HPDelta",
  hands: "AttackDelta",
  body: "CriticalChanceBase",
  feet: "SpeedDelta",
  planarSphere: "IceAddedRatio",
  linkRope: "SPRatioBase",
};
const profile: ScoreProfile = {
  id: "score:test",
  includeMainStat: true,
  mainStatWeight: 1,
  statWeights: {},
  gradeThresholds: { s: 80, a: 60, b: 40, c: 20 },
};
const cavern: BuildConfiguration = {
  id: "build:cavern",
  category: "cavern",
  characterDefinitionId: "1001",
  scoreProfileId: profile.id,
  cavern: { mode: "four-piece", setId: "a" },
  preferredMainStats: { body: [mains.body], feet: [mains.feet] },
};
const planar: BuildConfiguration = {
  id: "build:planar",
  category: "planar",
  characterDefinitionId: "1001",
  scoreProfileId: profile.id,
  planarSetId: "p",
  preferredMainStats: {
    planarSphere: [mains.planarSphere],
    linkRope: [mains.linkRope],
  },
};
const context: RelicScoringContext = {
  properties: new Map(
    Object.values(mains).map((id) => [id, { id, value_kind: "flat" }])
  ),
  relicPieces: new Map(
    BUILD_SLOT_ORDER.map((slot, index) => [
      slot,
      {
        id: slot,
        main_affix_group: index,
        sub_affix_group: index,
        max_level: 15,
      },
    ])
  ),
  mainAffixes: BUILD_SLOT_ORDER.map((slot, index) => ({
    group_id: index,
    property_id: mains[slot],
    max_level: 15,
    level_values: Array.from({ length: 16 }, (_, level) => level + 1),
  })),
  subAffixes: [],
};

function relic(slot: RelicSlot, setId: string, level = 15, suffix = ""): Relic {
  return {
    key: `relic:${setId}:${slot}${suffix}`,
    definitionId: slot,
    setId,
    slot,
    rarity: 5,
    level,
    mainStat: { statId: mains[slot], value: 1 },
    substats: [],
    locked: false,
    discarded: false,
  };
}

function accountWith(relics: Relic[]): AccountSnapshot {
  return AccountSnapshotSchema.parse({
    schemaVersion: 5,
    profileId: "account:test",
    characters: ["1001", "1002"].map((id) => ({
      key: `character:${id}`,
      definitionId: id,
      pathId: "destruction",
      combatTypeId: "ice",
      level: 80,
      ascension: 6,
      eidolon: 0,
      traces: {},
      relicKeys: relics
        .filter((entry) => entry.equippedCharacterKey === `character:${id}`)
        .map((entry) => entry.key),
    })),
    lightCones: [],
    relics,
    source: {
      provider: "scanner-export",
      formatVersion: 5,
      sourceVersion: "test",
      importedAt: "2026-10-19T12:00:00.000Z",
      coverage: {
        characters: "complete",
        lightCones: "complete",
        relics: "complete",
      },
      warnings: [],
    },
  });
}

const six = () =>
  BUILD_SLOT_ORDER.map((slot) =>
    relic(slot, ["planarSphere", "linkRope"].includes(slot) ? "p" : "a")
  );
const recommend = (
  account: AccountSnapshot,
  builds: BuildConfiguration[] = [cavern, planar]
) =>
  recommendCharacterEquipment(
    account,
    "character:1001",
    builds,
    [profile],
    context
  );

afterEach(() => useWorkspaceStore.getState().clearWorkspace());

describe("HSR inventory equipment recommendations", () => {
  it("completes six slots without imposing artifact-filter substat or grade gates", () => {
    const result = recommend(
      accountWith(six().map((entry) => ({ ...entry, level: 0 })))
    );
    expect(result.complete).toBe(true);
    expect(result.changedSlots).toEqual(BUILD_SLOT_ORDER);
    expect(result.recommendedScore).toBe(6.25);
    expect(result.currentScore).toBe(0);
  });

  it("requires all four outer pieces and the separate inner pair, with no off-set slot", () => {
    const pieces = six();
    pieces[3] = relic("feet", "unrelated");
    pieces[5] = relic("linkRope", "other-planar");
    const result = recommend(accountWith(pieces));
    expect(result.complete).toBe(false);
    expect(result.missingSlots).toEqual(["feet", "linkRope"]);
    expect(Object.keys(result.selected)).toHaveLength(4);
  });

  it("enumerates all 2 + 2 slot assignments rather than picking greedy per-slot sets", () => {
    const pieces = [
      relic("head", "a", 15),
      relic("head", "b", 14),
      relic("hands", "a", 15),
      relic("hands", "b", 0),
      relic("body", "a", 14),
      relic("body", "b", 14),
      relic("feet", "a", 0),
      relic("feet", "b", 15),
      relic("planarSphere", "p"),
      relic("linkRope", "p"),
    ];
    const result = recommend(accountWith(pieces), [
      { ...cavern, cavern: { mode: "two-plus-two", setIds: ["a", "b"] } },
      planar,
    ]);
    expect(
      BUILD_SLOT_ORDER.map((slot) => result.selected[slot]?.relic.setId)
    ).toEqual(["a", "a", "b", "b", "p", "p"]);
    expect(
      new Set(Object.values(result.selected).map((entry) => entry.relic.key))
        .size
    ).toBe(6);
  });

  it("reserves another Character's gear, excludes discarded items, and keeps ties equipped", () => {
    const own = six().map((entry) => ({
      ...entry,
      equippedCharacterKey: "character:1001",
      level: 3,
    }));
    const candidates = [
      relic("head", "a", 15, ":theirs"),
      relic("hands", "a", 15, ":discarded"),
      relic("body", "a", 3, ":tie"),
    ];
    candidates[0]!.equippedCharacterKey = "character:1002";
    candidates[1]!.discarded = true;
    const result = recommend(accountWith([...own, ...candidates]));
    expect(result.complete).toBe(true);
    expect(result.currentSetComplete).toBe(true);
    expect(result.changedSlots).toEqual([]);
  });

  it("respects enabled and minimum Eidolon and refuses ambiguous category choices", () => {
    const account = accountWith(six());
    expect(
      availableRecommendationBuilds(account, "1001", [
        { ...cavern, enabled: false },
        { ...cavern, id: "build:e1", minimumEidolon: 1 },
        planar,
      ])
    ).toEqual([planar]);
    expect(
      recommend(account, [{ ...cavern, minimumEidolon: 1 }, planar])
        .missingSlots
    ).toEqual(["head", "hands", "body", "feet"]);
    expect(() =>
      recommend(account, [cavern, { ...cavern, id: "build:duplicate" }, planar])
    ).toThrow("Choose one build");
  });

  it("updates both equipment references and preserves all unrelated inventory state", () => {
    const old = six().map((entry) => ({
      ...entry,
      key: `${entry.key}:old`,
      equippedCharacterKey: "character:1001",
      level: 0,
    }));
    const account = accountWith([...old, ...six()]);
    const recommendation = recommend(account);
    const keys = BUILD_SLOT_ORDER.map(
      (slot) => recommendation.selected[slot]!.relic.key
    );
    const result = equipRecommendedRelics(account, "character:1001", keys);
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.account.characters[0]!.relicKeys).toEqual(keys);
    expect(
      result.account.relics.filter(
        (entry) => entry.equippedCharacterKey === "character:1001"
      )
    ).toHaveLength(6);
    expect(
      result.account.relics
        .filter((entry) => entry.key.endsWith(":old"))
        .every((entry) => !entry.equippedCharacterKey)
    ).toBe(true);
    expect(result.account.source).toEqual(account.source);
    expect(result.account.characters[1]).toEqual(account.characters[1]);
    expect(account.characters[0]!.relicKeys).toHaveLength(6);
    expect(AccountSnapshotSchema.safeParse(result.account).success).toBe(true);
  });

  it("rejects missing/duplicate slots, stale account snapshots and stealing gear", () => {
    const ownedElsewhere = six().map((entry) => ({
      ...entry,
      equippedCharacterKey: "character:1002",
    }));
    const account = accountWith(ownedElsewhere);
    const keys = ownedElsewhere.map((entry) => entry.key);
    expect(equipRecommendedRelics(account, "character:1001", keys)).toEqual({
      status: "unavailable",
    });
    const fresh = accountWith(six());
    const freshKeys = fresh.relics.map((entry) => entry.key);
    expect(
      equipRecommendedRelics(fresh, "character:1001", freshKeys.slice(1))
    ).toEqual({ status: "unavailable" });
    expect(
      equipRecommendedRelics(fresh, "character:1001", [
        ...freshKeys.slice(1),
        freshKeys[1]!,
      ])
    ).toEqual({ status: "unavailable" });
    useWorkspaceStore.getState().replaceAccount(fresh);
    useWorkspaceStore
      .getState()
      .replaceAccount({ ...fresh, nickname: "changed" });
    expect(
      useWorkspaceStore
        .getState()
        .applyRecommendedLoadout(fresh, "character:1001", freshKeys)
    ).toBe(false);
    const current = useWorkspaceStore.getState().account!;
    expect(
      useWorkspaceStore
        .getState()
        .applyRecommendedLoadout(current, "character:1001", freshKeys)
    ).toBe(true);
    expect(useWorkspaceStore.getState().account?.nickname).toBe("changed");
  });
});
