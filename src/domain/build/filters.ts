import {
  type Relic,
  type RelicCategory,
  type RelicSlot,
  relicCategory,
} from "@/domain/account/schemas";
import type {
  BuildConfiguration,
  ComputedFilter,
  FilterClause,
  ScoreProfile,
} from "./schemas";

export interface RelicFilterContext {
  rarity: number;
  level: number;
  score: number;
  locked: boolean | null;
  equipped: boolean;
  category: RelicCategory;
}

export interface BuildRelicFilter {
  id: string;
  buildId: string;
  characterDefinitionId: string;
  scoreProfileId: string;
  slot: RelicSlot;
  setIds: readonly string[];
  mainStatIds: readonly string[];
  weightedStatIds: readonly string[];
  mustHaveStatIds: readonly string[];
  minimumDesiredStats: number;
  minimumScore: number;
}

export interface BuildFilterMatch {
  matches: boolean;
  structuralMatch: boolean;
  matchedStatIds: readonly string[];
  reasons: readonly (
    | "slot"
    | "set"
    | "main-stat"
    | "weighted-substats"
    | "minimum-score"
  )[];
}

const SLOT_ORDER: readonly RelicSlot[] = [
  "head",
  "hands",
  "body",
  "feet",
  "planarSphere",
  "linkRope",
];

function setIdsForSlot(
  build: BuildConfiguration,
  slot: RelicSlot
): readonly string[] {
  if (relicCategory(slot) === "planar") return [build.planarSetId];
  return build.cavern.mode === "four-piece"
    ? [build.cavern.setId]
    : build.cavern.setIds;
}

function mainStatsForSlot(
  build: BuildConfiguration,
  slot: RelicSlot
): readonly string[] {
  if (slot === "head") return ["HPDelta"];
  if (slot === "hands") return ["AttackDelta"];
  return build.preferredMainStats[slot];
}

export function deriveBuildFilters(
  build: BuildConfiguration,
  profile: ScoreProfile
): BuildRelicFilter[] {
  const weightedProfileStatIds = Object.entries(profile.statWeights)
    .filter(([, weight]) => weight >= 0.6)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .map(([statId]) => statId);
  const mustHaveProfileStatIds = Object.entries(profile.statWeights)
    .filter(([, weight]) => weight >= 0.9)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .map(([statId]) => statId);
  return SLOT_ORDER.map((slot) => {
    const mainStatIds = mainStatsForSlot(build, slot);
    // A stat is impossible as a substat only when every accepted alternative
    // uses it as the main stat. For example, a CR/CD Body must still consider
    // CD when the actual piece has CR as its main stat (and vice versa).
    const universalMainStatIds = mainStatIds.length === 1 ? mainStatIds : [];
    const weightedStatIds = weightedProfileStatIds.filter(
      (statId) => !universalMainStatIds.includes(statId)
    );
    const mustHaveStatIds = mustHaveProfileStatIds.filter(
      (statId) => !universalMainStatIds.includes(statId)
    );
    return {
      id: `build-filter:${build.id}:${slot}`,
      buildId: build.id,
      characterDefinitionId: build.characterDefinitionId,
      scoreProfileId: build.scoreProfileId,
      slot,
      setIds: setIdsForSlot(build, slot),
      mainStatIds,
      weightedStatIds,
      mustHaveStatIds,
      minimumDesiredStats: Math.min(3, weightedStatIds.length),
      minimumScore: profile.gradeThresholds.c,
    };
  });
}

export function evaluateBuildFilter(
  relic: Relic,
  filter: BuildRelicFilter,
  score?: number
): BuildFilterMatch {
  const reasons: BuildFilterMatch["reasons"][number][] = [];
  if (relic.slot === filter.slot) reasons.push("slot");
  if (filter.setIds.includes(relic.setId)) reasons.push("set");
  if (filter.mainStatIds.includes(relic.mainStat.statId)) {
    reasons.push("main-stat");
  }
  const eligibleWeightedStatIds = filter.weightedStatIds.filter(
    (statId) => statId !== relic.mainStat.statId
  );
  const eligibleMustHaveStatIds = filter.mustHaveStatIds.filter(
    (statId) => statId !== relic.mainStat.statId
  );
  const matchedStatIds = relic.substats
    .map((stat) => stat.statId)
    .filter((statId) => eligibleWeightedStatIds.includes(statId));
  const hasMustHave =
    eligibleMustHaveStatIds.length === 0 ||
    eligibleMustHaveStatIds.some((statId) => matchedStatIds.includes(statId));
  const minimumDesiredStats = Math.min(
    filter.minimumDesiredStats,
    eligibleWeightedStatIds.length
  );
  const enoughDesired =
    matchedStatIds.length >= minimumDesiredStats && hasMustHave;
  if (enoughDesired) reasons.push("weighted-substats");
  const passesScore = score === undefined || score >= filter.minimumScore;
  if (score !== undefined && passesScore) reasons.push("minimum-score");
  const structuralMatch =
    reasons.includes("slot") &&
    reasons.includes("set") &&
    reasons.includes("main-stat");
  return {
    matches: structuralMatch && enoughDesired && passesScore,
    structuralMatch,
    matchedStatIds,
    reasons,
  };
}

export function matchesBuildFilter(
  relic: Relic,
  filter: BuildRelicFilter,
  score?: number
): boolean {
  return evaluateBuildFilter(relic, filter, score).matches;
}

function matchesClause(
  context: RelicFilterContext,
  clause: FilterClause
): boolean {
  const actual = context[clause.field];
  if (clause.operation === "eq") return actual === clause.value;
  if (typeof actual !== "number") return false;
  if (clause.operation === "gte") return actual >= clause.value;
  return actual <= clause.value;
}

export function matchesComputedFilter(
  context: RelicFilterContext,
  filter: ComputedFilter
): boolean {
  const matches = filter.clauses.map((clause) =>
    matchesClause(context, clause)
  );
  return filter.mode === "all" ? matches.every(Boolean) : matches.some(Boolean);
}
