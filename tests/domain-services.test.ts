import { describe, expect, it } from "vitest";
import { relicCategory } from "@/domain/account/schemas";
import { matchesComputedFilter } from "@/domain/build/filters";
import type {
  BuildConfiguration,
  ComputedFilter,
  ScoreProfile,
  TriageRules,
} from "@/domain/build/schemas";
import {
  gradeScore,
  type RelicScoringContext,
  scoreRelic,
} from "@/domain/build/scoring";
import { triageRelic } from "@/domain/build/triage";
import { makeRelic } from "./fixtures";

const profile: ScoreProfile = {
  id: "score:crit",
  name: "Crit profile",
  statWeights: {
    "crit-rate": 1,
    "crit-dmg": 1,
    "attack-flat": 0.4,
    "hp-percent": 0.2,
  },
  includeMainStat: false,
  mainStatWeight: 0.5,
  gradeThresholds: { s: 50, a: 40, b: 30, c: 20 },
};

const scoringContext: RelicScoringContext = {
  properties: new Map([
    ["HPDelta", { id: "HPDelta", value_kind: "flat" }],
    ["crit-rate", { id: "crit-rate", value_kind: "ratio" }],
    ["crit-dmg", { id: "crit-dmg", value_kind: "ratio" }],
    ["attack-flat", { id: "attack-flat", value_kind: "flat" }],
    ["hp-percent", { id: "hp-percent", value_kind: "ratio" }],
  ]),
  relicPieces: new Map([
    [
      "relic-definition:1",
      {
        id: "relic-definition:1",
        main_affix_group: 1,
        sub_affix_group: 2,
        max_level: 15,
      },
    ],
  ]),
  mainAffixes: [
    {
      group_id: 1,
      property_id: "HPDelta",
      max_level: 15,
      level_values: Array.from(
        { length: 16 },
        (_, level) => 112.896 + level * 39.5136
      ),
    },
  ],
  subAffixes: [
    { group_id: 2, property_id: "crit-rate", roll_values: [0.025, 0.032] },
    { group_id: 2, property_id: "crit-dmg", roll_values: [0.05, 0.064] },
    { group_id: 2, property_id: "attack-flat", roll_values: [13, 16] },
    { group_id: 2, property_id: "hp-percent", roll_values: [0.03, 0.04] },
  ],
};

const rules: TriageRules = {
  keepScoreAtLeast: 40,
  reviewScoreAtLeast: 20,
  protectLocked: true,
  protectEquipped: true,
};

describe("HSR build services", () => {
  it("normalizes flat and percentage-point substats into high-roll counts", () => {
    const result = scoreRelic(
      makeRelic({
        mainStat: { statId: "HPDelta", value: 705 },
        substats: [
          { statId: "crit-rate", value: 3.2 },
          { statId: "attack-flat", value: 16 },
        ],
      }),
      profile,
      scoringContext
    );
    expect(result.normalizedRolls).toBe(2);
    expect(result.weightedRolls).toBe(1.4);
    expect(result.contributions["crit-rate"]?.normalizedRolls).toBe(1);
    expect(result.contributions["attack-flat"]?.normalizedRolls).toBe(1);
  });

  it("normalizes against the best achievable weighted roll distribution", () => {
    const result = scoreRelic(
      makeRelic({
        mainStat: { statId: "HPDelta", value: 705 },
        substats: [
          { statId: "crit-rate", value: 19.2 },
          { statId: "crit-dmg", value: 6.4 },
          { statId: "attack-flat", value: 16 },
          { statId: "hp-percent", value: 4 },
        ],
      }),
      profile,
      scoringContext
    );
    expect(result.maximumWeightedRolls).toBe(7.6);
    expect(result.substatScore).toBe(100);
    expect(result.total).toBe(100);
    expect(result.grade).toBe("S");
  });

  it("leaves configurable-main mismatches ungraded", () => {
    const build: BuildConfiguration = {
      id: "build:1",
      name: "Build",
      characterDefinitionId: "character:1",
      scoreProfileId: profile.id,
      cavern: { mode: "four-piece", setId: "relic-set:1" },
      planarSetId: "planar-set:1",
      preferredMainStats: {
        body: ["crit-rate"],
        feet: ["hp-percent"],
        planarSphere: ["hp-percent"],
        linkRope: ["hp-percent"],
      },
    };
    const result = scoreRelic(
      makeRelic({
        slot: "body",
        mainStat: { statId: "hp-percent", value: 43.2 },
      }),
      profile,
      scoringContext,
      build
    );
    expect(result.mainStatAccepted).toBe(false);
    expect(result.grade).toBeNull();
  });

  it("uses exact editable grade boundaries", () => {
    expect(gradeScore(50, profile.gradeThresholds)).toBe("S");
    expect(gradeScore(40, profile.gradeThresholds)).toBe("A");
    expect(gradeScore(30, profile.gradeThresholds)).toBe("B");
    expect(gradeScore(20, profile.gradeThresholds)).toBe("C");
    expect(gradeScore(19.99, profile.gradeThresholds)).toBe("D");
  });

  it("derives Cavern Relic and Planar Ornament categories from six slots", () => {
    expect(relicCategory("head")).toBe("cavern");
    expect(relicCategory("planarSphere")).toBe("planar");
    expect(relicCategory("linkRope")).toBe("planar");
  });

  it("evaluates all/any computed filters", () => {
    const filter: ComputedFilter = {
      id: "filter:review",
      name: "Reviewable five-star pieces",
      mode: "all",
      clauses: [
        { field: "rarity", operation: "eq", value: 5 },
        { field: "score", operation: "gte", value: 10 },
        { field: "category", operation: "eq", value: "cavern" },
      ],
    };
    expect(
      matchesComputedFilter(
        {
          rarity: 5,
          level: 15,
          score: 12.8,
          locked: false,
          equipped: false,
          category: "cavern",
        },
        filter
      )
    ).toBe(true);
  });

  it("protects equipped and locked pieces and only recommends salvage review", () => {
    expect(
      triageRelic(
        {
          score: 0,
          locked: true,
          equipped: false,
          configuredBuildCount: 1,
          matchingBuildCount: 0,
        },
        rules
      )
    ).toEqual({ decision: "keep", reasons: ["locked"] });
    expect(
      triageRelic(
        {
          score: 0,
          locked: false,
          equipped: false,
          configuredBuildCount: 1,
          matchingBuildCount: 0,
        },
        rules
      ).decision
    ).toBe("salvage-review");
  });
});
