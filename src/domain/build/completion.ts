import type {
  AccountSnapshot,
  Relic,
  RelicSlot,
} from "@/domain/game-account/schemas";
import { buildMainStats } from "./configuration";
import { BUILD_SLOT_ORDER, buildSlots } from "./evaluation";
import { deriveBuildFilters, evaluateBuildFilter } from "./filters";
import type { BuildConfiguration, ScoreProfile } from "./schemas";
import {
  type RelicScore,
  type RelicScoringContext,
  scoreRelic,
} from "./scoring";

export type CompletionStatus = "missing" | "main-stat" | "develop" | "ready";

export interface BuildSlotCompletion {
  slot: RelicSlot;
  setId: string;
  mainStatIds: readonly string[];
  candidateCount: number;
  acceptedCount: number;
  relic: Relic | null;
  score: RelicScore | null;
  potentialScore: number | null;
  status: CompletionStatus;
}

export interface BuildCompletion {
  build: BuildConfiguration;
  slots: readonly BuildSlotCompletion[];
  acceptedCount: number;
  readyCount: number;
  averageScore: number | null;
  complete: boolean;
}

/** Optimistic upper bound: every remaining enhancement hits the best eligible stat.
 * Revealing a new line consumes an enhancement too. This is not an expectation. */
export function estimateRelicPotential(
  relic: Relic,
  profile: ScoreProfile,
  context: RelicScoringContext,
  build: BuildConfiguration
): number {
  const piece = context.relicPieces.get(relic.definitionId);
  if (!piece)
    throw new Error(
      `Missing completion reference for Relic ${relic.definitionId}`
    );
  const score = scoreRelic(relic, profile, context, build);
  if (relic.level >= piece.max_level) return score.total;
  const remaining = Math.max(
    0,
    Math.floor(piece.max_level / 3) - Math.floor(relic.level / 3)
  );
  const highestWeight = Math.max(
    0,
    ...context.subAffixes
      .filter(
        (affix) =>
          affix.group_id === piece.sub_affix_group &&
          affix.property_id !== relic.mainStat.statId &&
          (relic.substats.length < 4 ||
            relic.substats.some((stat) => stat.statId === affix.property_id))
      )
      .map((affix) => profile.statWeights[affix.property_id] ?? 0)
  );
  const substatScore =
    score.maximumWeightedRolls > 0
      ? Math.min(
          100,
          ((score.weightedRolls + remaining * highestWeight) /
            score.maximumWeightedRolls) *
            100
        )
      : 0;
  const mainWeight = profile.includeMainStat ? profile.mainStatWeight : 0;
  const mainScore = scoreRelic(
    { ...relic, level: piece.max_level },
    profile,
    context,
    build
  ).mainStatScore;
  return Number(
    Math.max(
      score.total,
      mainScore * mainWeight + substatScore * (1 - mainWeight)
    ).toFixed(2)
  );
}

function assignments(
  build: BuildConfiguration
): ReadonlyMap<RelicSlot, string>[] {
  const slots = buildSlots(build);
  if (build.category === "planar")
    return [new Map(slots.map((slot) => [slot, build.planarSetId]))];
  const plan = build.cavern;
  if (plan.mode === "four-piece")
    return [new Map(slots.map((slot) => [slot, plan.setId]))];
  const result: ReadonlyMap<RelicSlot, string>[] = [];
  for (let first = 0; first < 4; first += 1) {
    for (let second = first + 1; second < 4; second += 1) {
      result.push(
        new Map(
          slots.map((slot, index) => [
            slot,
            plan.setIds[index === first || index === second ? 0 : 1],
          ])
        )
      );
    }
  }
  return result;
}

/** Each build is an independent inventory possibility; pieces may be shared by
 * different builds. Cavern assignments always reserve exactly two slots per set. */
export function evaluateBuildCompletion(
  account: AccountSnapshot,
  build: BuildConfiguration,
  profile: ScoreProfile,
  context: RelicScoringContext
): BuildCompletion {
  const filters = deriveBuildFilters(build, profile);
  const candidates = new Map<RelicSlot, BuildSlotCompletion[]>();
  for (const slot of buildSlots(build)) {
    const mainStatIds = buildMainStats(build, slot);
    const filter = filters.find((candidate) => candidate.slot === slot);
    const setIds =
      build.category === "planar"
        ? [build.planarSetId]
        : build.cavern.mode === "four-piece"
          ? [build.cavern.setId]
          : build.cavern.setIds;
    candidates.set(
      slot,
      setIds.map((setId) => {
        const pieces = account.relics
          .filter(
            (relic) =>
              relic.slot === slot &&
              relic.setId === setId &&
              relic.discarded !== true
          )
          .map((relic) => ({
            relic,
            score: scoreRelic(relic, profile, context, build),
          }))
          .map((entry) => ({
            ...entry,
            ready: Boolean(
              filter &&
                evaluateBuildFilter(entry.relic, filter, entry.score.total)
                  .matches
            ),
          }))
          .sort(
            (left, right) =>
              Number(right.score.mainStatAccepted) -
                Number(left.score.mainStatAccepted) ||
              Number(right.ready) - Number(left.ready) ||
              right.score.total - left.score.total ||
              right.relic.rarity - left.relic.rarity ||
              left.relic.key.localeCompare(right.relic.key)
          );
        const best = pieces[0];
        return {
          slot,
          setId,
          mainStatIds,
          candidateCount: pieces.length,
          acceptedCount: pieces.filter(({ score }) => score.mainStatAccepted)
            .length,
          relic: best?.relic ?? null,
          score: best?.score ?? null,
          potentialScore: best
            ? estimateRelicPotential(best.relic, profile, context, build)
            : null,
          status: !best
            ? "missing"
            : !best.score.mainStatAccepted
              ? "main-stat"
              : best.ready
                ? "ready"
                : "develop",
        };
      })
    );
  }
  const choices = assignments(build).map((assignment) => {
    const slots = BUILD_SLOT_ORDER.flatMap((slot) => {
      const candidate = candidates
        .get(slot)
        ?.find((entry) => entry.setId === assignment.get(slot));
      return candidate ? [candidate] : [];
    });
    const scores = slots.flatMap((slot) =>
      slot.score?.mainStatAccepted ? [slot.score.total] : []
    );
    return {
      build,
      slots,
      acceptedCount: scores.length,
      readyCount: slots.filter((slot) => slot.status === "ready").length,
      averageScore:
        scores.length > 0
          ? Number(
              (
                scores.reduce((sum, value) => sum + value, 0) / scores.length
              ).toFixed(2)
            )
          : null,
      complete: scores.length === slots.length,
    };
  });
  const best = choices.sort(
    (left, right) =>
      right.acceptedCount - left.acceptedCount ||
      right.readyCount - left.readyCount ||
      (right.averageScore ?? 0) - (left.averageScore ?? 0) ||
      right.slots.filter((slot) => slot.relic).length -
        left.slots.filter((slot) => slot.relic).length
  )[0];
  if (!best)
    throw new Error(`Missing legal set assignment for build ${build.id}`);
  return best;
}

export function evaluateAccountCompletion(
  account: AccountSnapshot,
  builds: readonly BuildConfiguration[],
  profiles: readonly ScoreProfile[],
  context: RelicScoringContext
): BuildCompletion[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return builds.flatMap((build) => {
    if (build.enabled === false) return [];
    const character = account.characters.find(
      (entry) => entry.definitionId === build.characterDefinitionId
    );
    if (!character || character.eidolon < (build.minimumEidolon ?? 0))
      return [];
    const profile = profileById.get(build.scoreProfileId);
    if (!profile)
      throw new Error(`Missing score profile ${build.scoreProfileId}`);
    return [evaluateBuildCompletion(account, build, profile, context)];
  });
}
