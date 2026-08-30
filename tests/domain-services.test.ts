import { describe, expect, it } from "vitest";
import { relicCategory } from "@/domain/account/schemas";
import { matchesComputedFilter } from "@/domain/build/filters";
import type {
  ComputedFilter,
  ScoreProfile,
  TriageRules,
} from "@/domain/build/schemas";
import { scoreRelic } from "@/domain/build/scoring";
import { triageRelic } from "@/domain/build/triage";
import { makeRelic } from "./fixtures";

const profile: ScoreProfile = {
  id: "score:crit",
  name: "Crit profile",
  statWeights: { "crit-rate": 2, "crit-dmg": 1 },
  includeMainStat: false,
};

const rules: TriageRules = {
  keepScoreAtLeast: 20,
  reviewScoreAtLeast: 10,
  protectLocked: true,
  protectEquipped: true,
};

describe("HSR-neutral build services", () => {
  it("scores user-selected stats without a damage engine", () => {
    expect(scoreRelic(makeRelic(), profile)).toEqual({
      total: 12.8,
      contributions: { "crit-rate": 6.4, "crit-dmg": 6.4 },
    });
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

  it("protects locked/equipped pieces and never performs a destructive action", () => {
    expect(
      triageRelic(
        {
          rarity: 5,
          level: 0,
          score: 0,
          locked: true,
          equipped: false,
          category: "cavern",
        },
        rules
      )
    ).toEqual({ decision: "keep", reasons: ["locked"] });
    expect(
      triageRelic(
        {
          rarity: 5,
          level: 0,
          score: 5,
          locked: false,
          equipped: false,
          category: "planar",
        },
        rules
      ).decision
    ).toBe("salvage-candidate");
  });
});
