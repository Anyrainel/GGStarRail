import {
  type Relic,
  type RelicSlot,
  relicCategory,
} from "@/domain/account/schemas";
import {
  BUILD_SLOT_ORDER,
  type BuildLoadoutResult,
  recommendBuildLoadout,
} from "@/domain/build/evaluation";
import {
  type BuildRelicFilter,
  deriveBuildFilters,
} from "@/domain/build/filters";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { type RelicScore, scoreRelic } from "@/domain/build/scoring";
import type {
  ResourceRecommendationInput,
  ResourceRelicDefinition,
  ResourceSuggestion,
} from "./types";

const CAVERN_SLOTS = BUILD_SLOT_ORDER.slice(0, 4);
const FIVE_STAR_RARITY = 5;

function round(value: number): number {
  return Number(value.toFixed(2));
}

function priorityFor(opportunityScore: number): ResourceSuggestion["priority"] {
  if (opportunityScore >= 30) return "high";
  if (opportunityScore >= 15) return "medium";
  return "low";
}

function assignedSets(
  build: BuildConfiguration,
  recommendation: BuildLoadoutResult
): ReadonlyMap<RelicSlot, string> {
  const assigned = new Map<RelicSlot, string>();
  assigned.set("planarSphere", build.planarSetId);
  assigned.set("linkRope", build.planarSetId);

  if (build.cavern.mode === "four-piece") {
    for (const slot of CAVERN_SLOTS) assigned.set(slot, build.cavern.setId);
    return assigned;
  }

  const [firstSetId, secondSetId] = build.cavern.setIds;
  const counts = new Map([
    [firstSetId, 0],
    [secondSetId, 0],
  ]);
  for (const slot of CAVERN_SLOTS) {
    const selectedSetId = recommendation.selected[slot]?.relic.setId;
    if (selectedSetId !== firstSetId && selectedSetId !== secondSetId) continue;
    assigned.set(slot, selectedSetId);
    counts.set(selectedSetId, (counts.get(selectedSetId) ?? 0) + 1);
  }
  for (const slot of CAVERN_SLOTS) {
    if (assigned.has(slot)) continue;
    const setId = (counts.get(firstSetId) ?? 0) < 2 ? firstSetId : secondSetId;
    assigned.set(slot, setId);
    counts.set(setId, (counts.get(setId) ?? 0) + 1);
  }
  return assigned;
}

function shapeMatches(
  relic: Relic,
  filter: BuildRelicFilter,
  setId: string
): boolean {
  return (
    relic.discarded !== true &&
    relic.rarity === FIVE_STAR_RARITY &&
    relic.slot === filter.slot &&
    relic.setId === setId &&
    filter.mainStatIds.includes(relic.mainStat.statId)
  );
}

function usefulSubstatCount(relic: Relic, profile: ScoreProfile): number {
  return relic.substats.filter(
    ({ statId }) => (profile.statWeights[statId] ?? 0) > 0
  ).length;
}

function optimisticLevelScore(
  relic: Relic,
  score: RelicScore,
  targetLevel: number,
  profile: ScoreProfile,
  input: ResourceRecommendationInput,
  build: BuildConfiguration
): number {
  const piece = input.scoringContext.relicPieces.get(relic.definitionId);
  if (!piece) {
    throw new Error(
      `Missing resource reference for Relic ${relic.definitionId}`
    );
  }
  const strongestEligibleWeight = Math.max(
    0,
    ...input.scoringContext.subAffixes
      .filter(
        (affix) =>
          affix.group_id === piece.sub_affix_group &&
          affix.property_id !== relic.mainStat.statId
      )
      .map((affix) => profile.statWeights[affix.property_id] ?? 0)
  );
  const remainingEnhancements = Math.max(
    0,
    Math.floor(targetLevel / 3) - Math.floor(relic.level / 3)
  );
  const optimisticWeighted =
    score.weightedRolls + remainingEnhancements * strongestEligibleWeight;
  const optimisticSubstatScore =
    score.maximumWeightedRolls > 0
      ? Math.min(100, (optimisticWeighted / score.maximumWeightedRolls) * 100)
      : 0;
  const maxLevelScore = scoreRelic(
    { ...relic, level: targetLevel },
    profile,
    input.scoringContext,
    build
  );
  const mainWeight = profile.includeMainStat ? profile.mainStatWeight : 0;
  return round(
    Math.min(
      100,
      maxLevelScore.mainStatScore * mainWeight +
        optimisticSubstatScore * (1 - mainWeight)
    )
  );
}

function optimisticRerollScore(
  relic: Relic,
  score: RelicScore,
  profile: ScoreProfile
): number {
  const lines = relic.substats.map(({ statId }) => {
    const contribution = score.contributions[statId];
    return {
      rolls: contribution?.normalizedRolls ?? 0,
      weight: profile.statWeights[statId] ?? 0,
    };
  });
  const bestWeight = Math.max(0, ...lines.map(({ weight }) => weight));
  const retainedBaseWeighted = lines.reduce(
    (total, { rolls, weight }) => total + Math.min(1, rolls) * weight,
    0
  );
  const distributableRolls = lines.reduce(
    (total, { rolls }) => total + Math.max(0, rolls - 1),
    0
  );
  const optimisticWeighted =
    retainedBaseWeighted + distributableRolls * bestWeight;
  const substatScore =
    score.maximumWeightedRolls > 0
      ? Math.min(100, (optimisticWeighted / score.maximumWeightedRolls) * 100)
      : 0;
  const mainWeight = profile.includeMainStat ? profile.mainStatWeight : 0;
  return round(
    Math.min(
      100,
      score.mainStatScore * mainWeight + substatScore * (1 - mainWeight)
    )
  );
}

function targetDefinition(
  definitions: readonly ResourceRelicDefinition[],
  setId: string,
  slot: RelicSlot
): ResourceRelicDefinition | undefined {
  return definitions
    .filter(
      (definition) =>
        definition.setId === setId &&
        definition.slot === slot &&
        definition.rarity === FIVE_STAR_RARITY
    )
    .sort(
      (left, right) =>
        right.maxLevel - left.maxLevel || left.id.localeCompare(right.id)
    )[0];
}

function suggestionsForSlot(
  input: ResourceRecommendationInput,
  build: BuildConfiguration,
  profile: ScoreProfile,
  filter: BuildRelicFilter,
  setId: string
): ResourceSuggestion[] {
  const { account, relicDefinitions, scoringContext, settings } = input;
  const target = targetDefinition(relicDefinitions, setId, filter.slot);
  if (!target) return [];
  const mainStatId = filter.mainStatIds[0];
  if (!mainStatId) return [];
  const candidates = account.relics
    .filter((relic) => shapeMatches(relic, filter, setId))
    .map((relic) => ({
      relic,
      score: scoreRelic(relic, profile, scoringContext, build),
    }))
    .sort(
      (left, right) =>
        right.score.total - left.score.total ||
        left.relic.key.localeCompare(right.relic.key)
    );
  const bestScore = candidates[0]?.score.total ?? null;
  const category = relicCategory(filter.slot);
  const common = {
    buildId: build.id,
    characterDefinitionId: build.characterDefinitionId,
    setId,
    targetDefinitionId: target.id,
    slot: filter.slot,
    category,
    mainStatId,
  } as const;
  const suggestions: ResourceSuggestion[] = [];

  if (settings.enabledActions["level-up"]) {
    const levelCandidate = candidates
      .filter(
        ({ relic }) =>
          relic.level < target.maxLevel &&
          usefulSubstatCount(relic, profile) >= 2
      )
      .map(({ relic, score }) => {
        const optimisticScore = optimisticLevelScore(
          relic,
          score,
          target.maxLevel,
          profile,
          input,
          build
        );
        return {
          relic,
          score,
          optimisticScore,
          opportunity: round(Math.max(0, optimisticScore - score.total)),
        };
      })
      .filter(
        ({ opportunity }) => opportunity >= settings.minimumScoreGap["level-up"]
      )
      .sort(
        (left, right) =>
          right.optimisticScore - left.optimisticScore ||
          right.opportunity - left.opportunity ||
          left.relic.key.localeCompare(right.relic.key)
      )[0];
    if (levelCandidate) {
      suggestions.push({
        ...common,
        id: `resource:${build.id}:${filter.slot}:level-up:${levelCandidate.relic.key}`,
        kind: "level-up",
        priority: priorityFor(levelCandidate.opportunity),
        relicKey: levelCandidate.relic.key,
        currentLevel: levelCandidate.relic.level,
        targetLevel: target.maxLevel,
        currentScore: levelCandidate.score.total,
        optimisticScore: levelCandidate.optimisticScore,
        opportunityScore: levelCandidate.opportunity,
      });
    }
  }

  if (settings.enabledActions.synthesize) {
    const opportunity = round(100 - (bestScore ?? 0));
    if (opportunity >= settings.minimumScoreGap.synthesize) {
      suggestions.push({
        ...common,
        id: `resource:${build.id}:${filter.slot}:synthesize:${setId}:${mainStatId}`,
        kind: "synthesize",
        priority: priorityFor(opportunity),
        currentScore: bestScore,
        opportunityScore: opportunity,
        relicRemains: 100,
        selfModelingResin:
          filter.slot === "head" || filter.slot === "hands" ? 0 : 1,
      });
    }
  }

  if (settings.enabledActions.reroll) {
    const rerollCandidate = candidates
      .filter(
        ({ relic }) =>
          relic.level === target.maxLevel &&
          usefulSubstatCount(relic, profile) >= 2
      )
      .map(({ relic, score }) => {
        const optimisticScore = optimisticRerollScore(relic, score, profile);
        return {
          relic,
          score,
          optimisticScore,
          opportunity: round(Math.max(0, optimisticScore - score.total)),
        };
      })
      .filter(
        ({ opportunity }) => opportunity >= settings.minimumScoreGap.reroll
      )
      .sort(
        (left, right) =>
          right.opportunity - left.opportunity ||
          left.relic.key.localeCompare(right.relic.key)
      )[0];
    if (rerollCandidate) {
      suggestions.push({
        ...common,
        id: `resource:${build.id}:${filter.slot}:reroll:${rerollCandidate.relic.key}`,
        kind: "reroll",
        priority: priorityFor(rerollCandidate.opportunity),
        relicKey: rerollCandidate.relic.key,
        targetLevel: target.maxLevel,
        currentScore: rerollCandidate.score.total,
        optimisticScore: rerollCandidate.optimisticScore,
        opportunityScore: rerollCandidate.opportunity,
        variableDice: 1,
      });
    }
  }

  return suggestions;
}

export function generateResourceSuggestions(
  input: ResourceRecommendationInput
): ResourceSuggestion[] {
  const profileById = new Map(
    input.scoreProfiles.map((profile) => [profile.id, profile])
  );
  const suggestions = input.builds.flatMap((build) => {
    const profile = profileById.get(build.scoreProfileId);
    if (!profile) return [];
    const filters = deriveBuildFilters(build, profile);
    const recommendation = recommendBuildLoadout(
      input.account,
      build,
      profile,
      input.scoringContext
    );
    const setBySlot = assignedSets(build, recommendation);
    return filters.flatMap((filter) => {
      const setId = setBySlot.get(filter.slot);
      return setId
        ? suggestionsForSlot(input, build, profile, filter, setId)
        : [];
    });
  });

  const actionOrder: Record<ResourceSuggestion["kind"], number> = {
    "level-up": 0,
    synthesize: 1,
    reroll: 2,
  };
  const priorityOrder: Record<ResourceSuggestion["priority"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return suggestions.sort(
    (left, right) =>
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      right.opportunityScore - left.opportunityScore ||
      actionOrder[left.kind] - actionOrder[right.kind] ||
      left.id.localeCompare(right.id)
  );
}
