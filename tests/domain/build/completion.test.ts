import { describe, expect, it } from "vitest";
import {
  estimateRelicPotential,
  evaluateAccountCompletion,
  evaluateBuildCompletion,
} from "@/domain/build/completion";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import type { RelicScoringContext } from "@/domain/build/scoring";
import type { Relic, RelicSlot } from "@/domain/game-account/schemas";
import { makeAccountSnapshot, makeRelic } from "../../fixtures";

const profile: ScoreProfile = {
  id: "score:test",
  statWeights: { Crit: 1 },
  includeMainStat: false,
  mainStatWeight: 0,
  gradeThresholds: { s: 80, a: 60, b: 40, c: 20 },
};
const build: BuildConfiguration = {
  id: "build:cavern",
  characterDefinitionId: "character:trailblazer",
  scoreProfileId: profile.id,
  category: "cavern",
  cavern: { mode: "two-plus-two", setIds: ["set:a", "set:b"] },
  preferredMainStats: { body: ["CritMain"], feet: ["Speed"] },
};
const mainBySlot: Record<RelicSlot, string> = {
  head: "HPDelta",
  hands: "AttackDelta",
  body: "CritMain",
  feet: "Speed",
  planarSphere: "Damage",
  linkRope: "Energy",
};
const context: RelicScoringContext = {
  properties: new Map(
    [
      "HPDelta",
      "AttackDelta",
      "CritMain",
      "Speed",
      "Damage",
      "Energy",
      "Wrong",
      "Crit",
      "A",
      "B",
      "C",
      "D",
    ].map((id) => [id, { id, value_kind: "flat" }])
  ),
  relicPieces: new Map([
    [
      "definition:test",
      {
        id: "definition:test",
        main_affix_group: 1,
        sub_affix_group: 1,
        max_level: 15,
      },
    ],
  ]),
  mainAffixes: Object.values(mainBySlot).map((property_id) => ({
    group_id: 1,
    property_id,
    max_level: 15,
    level_values: Array.from({ length: 16 }, (_, index) => index + 1),
  })),
  subAffixes: ["Crit", "A", "B", "C", "D"].map((property_id) => ({
    group_id: 1,
    property_id,
    roll_values: [1],
  })),
};
function piece(
  slot: RelicSlot,
  setId = "set:a",
  overrides: Partial<Relic> = {}
): Relic {
  return makeRelic({
    key: `${setId}:${slot}`,
    definitionId: "definition:test",
    setId,
    slot,
    mainStat: { statId: mainBySlot[slot], value: 16 },
    substats: [{ statId: "Crit", value: 3 }],
    ...overrides,
  });
}
function account(relics: Relic[]) {
  return { ...makeAccountSnapshot(), relics };
}

describe("inventory build completion", () => {
  it("does not mistake three pieces of one set and one of another for 2 + 2", () => {
    const result = evaluateBuildCompletion(
      account([
        piece("head"),
        piece("hands"),
        piece("body"),
        piece("feet", "set:b"),
      ]),
      build,
      profile,
      context
    );
    expect(result.acceptedCount).toBe(3);
    expect(result.complete).toBe(false);
    expect(result.slots.filter((slot) => slot.setId === "set:a")).toHaveLength(
      2
    );
    expect(result.slots.filter((slot) => slot.setId === "set:b")).toHaveLength(
      2
    );
    expect(
      result.slots.filter((slot) => slot.status === "missing")
    ).toHaveLength(1);
  });

  it("finds the valid 2 + 2 slot allocation instead of fixing either set to a slot", () => {
    const result = evaluateBuildCompletion(
      account([
        piece("head", "set:b"),
        piece("hands", "set:b"),
        piece("body"),
        piece("feet"),
      ]),
      build,
      profile,
      context
    );
    expect(result.complete).toBe(true);
    expect(result.readyCount).toBe(4);
    expect(result.slots.map((slot) => slot.setId)).toEqual([
      "set:b",
      "set:b",
      "set:a",
      "set:a",
    ]);
  });

  it("distinguishes a wrong main stat from a missing or low-score piece", () => {
    const four: BuildConfiguration = {
      ...build,
      cavern: { mode: "four-piece", setId: "set:a" },
    };
    const result = evaluateBuildCompletion(
      account([
        piece("head", "set:a", { level: 0, substats: [] }),
        piece("body", "set:a", { mainStat: { statId: "Wrong", value: 1 } }),
        piece("feet", "set:a", { discarded: true }),
      ]),
      four,
      profile,
      context
    );
    expect(result.slots.map((slot) => slot.status)).toEqual([
      "develop",
      "missing",
      "main-stat",
      "missing",
    ]);
    expect(result.acceptedCount).toBe(1);
    expect(result.slots[0]?.potentialScore).toBeGreaterThan(0);
  });

  it("evaluates Planar Ornaments separately and never fills a Cavern gap with an off-set piece", () => {
    const planar: BuildConfiguration = {
      id: "build:planar",
      characterDefinitionId: build.characterDefinitionId,
      scoreProfileId: profile.id,
      category: "planar",
      planarSetId: "set:p",
      preferredMainStats: { planarSphere: ["Damage"], linkRope: ["Energy"] },
    };
    const inventory = account([
      piece("head", "set:off"),
      piece("planarSphere", "set:p"),
      piece("linkRope", "set:p"),
    ]);
    const results = evaluateAccountCompletion(
      inventory,
      [build, planar],
      [profile],
      context
    );
    expect(results[0]?.acceptedCount).toBe(0);
    expect(results[0]?.slots).toHaveLength(4);
    expect(results[1]?.slots).toHaveLength(2);
    expect(results[1]?.complete).toBe(true);
  });

  it("uses equipped inventory while excluding disabled, unowned and unavailable Eidolon builds", () => {
    const inventory = account([
      piece("head", "set:a", { equippedCharacterKey: "character:other" }),
    ]);
    inventory.characters = inventory.characters.map((character) => ({
      ...character,
      eidolon: 0,
    }));
    const results = evaluateAccountCompletion(
      inventory,
      [
        build,
        { ...build, id: "disabled", enabled: false },
        { ...build, id: "e1", minimumEidolon: 1 },
        { ...build, id: "unowned", characterDefinitionId: "unknown" },
      ],
      [profile],
      context
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.acceptedCount).toBe(1);
  });

  it("throws for a missing referenced profile instead of silently hiding a build", () => {
    expect(() =>
      evaluateAccountCompletion(account([]), [build], [], context)
    ).toThrow("Missing score profile");
  });
});

describe("Relic leveling potential", () => {
  it("does not manufacture potential from rounded rolls on a max-level piece", () => {
    const relic = piece("head", "set:a", {
      substats: [{ statId: "Crit", value: 0.137 }],
    });
    expect(estimateRelicPotential(relic, profile, context, build)).toBe(2.28);
  });
  it("cannot invent a weighted substat when all four lines are already revealed", () => {
    const relic = piece("head", "set:a", {
      level: 0,
      substats: ["A", "B", "C", "D"].map((statId) => ({ statId, value: 1 })),
    });
    expect(estimateRelicPotential(relic, profile, context, build)).toBe(0);
  });

  it("allows a useful unrevealed line and becomes exact at max level", () => {
    expect(
      estimateRelicPotential(
        piece("head", "set:a", { level: 0, substats: [] }),
        profile,
        context,
        build
      )
    ).toBeGreaterThan(0);
    expect(estimateRelicPotential(piece("head"), profile, context, build)).toBe(
      50
    );
  });
});
