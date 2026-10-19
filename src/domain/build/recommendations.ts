import {
  type AccountSnapshot,
  AccountSnapshotSchema,
  type RelicSlot,
  relicCategory,
} from "@/domain/game-account/schemas";
import { buildMainStats } from "./configuration";
import { BUILD_SLOT_ORDER, type ScoredRelic } from "./evaluation";
import type { BuildConfiguration, ScoreProfile } from "./schemas";
import { type RelicScoringContext, scoreRelic } from "./scoring";

export interface EquipmentRecommendation {
  characterKey: string;
  current: Partial<Record<RelicSlot, ScoredRelic>>;
  selected: Partial<Record<RelicSlot, ScoredRelic>>;
  missingSlots: RelicSlot[];
  changedSlots: RelicSlot[];
  currentScore: number;
  recommendedScore: number;
  scoreGain: number;
  currentSetComplete: boolean;
  complete: boolean;
}

/** Only active configurations available at the owned Character's Eidolon. */
export function availableRecommendationBuilds(
  account: AccountSnapshot,
  characterDefinitionId: string,
  builds: readonly BuildConfiguration[]
): BuildConfiguration[] {
  const character = account.characters.find(
    (entry) => entry.definitionId === characterDefinitionId
  );
  return character
    ? builds.filter(
        (build) =>
          build.characterDefinitionId === characterDefinitionId &&
          build.enabled !== false &&
          character.eidolon >= (build.minimumEidolon ?? 0)
      )
    : [];
}

function assignments(build: BuildConfiguration): Map<RelicSlot, string>[] {
  const slots = BUILD_SLOT_ORDER.filter(
    (slot) => relicCategory(slot) === build.category
  );
  if (build.category === "planar")
    return [new Map(slots.map((slot) => [slot, build.planarSetId]))];
  if (build.cavern.mode === "four-piece") {
    const setId = build.cavern.setId;
    return [new Map(slots.map((slot) => [slot, setId]))];
  }
  const setIds = build.cavern.setIds;
  return slots.flatMap((_, first) =>
    slots.flatMap((__, second) =>
      second > first
        ? [
            new Map(
              slots.map((slot, index) => [
                slot,
                setIds[index === first || index === second ? 0 : 1],
              ])
            ),
          ]
        : []
    )
  );
}

function sum(selected: Partial<Record<RelicSlot, ScoredRelic>>): number {
  return Object.values(selected).reduce(
    (total, entry) => total + entry.score.total,
    0
  );
}

/** A complete 4 + 2 proposal; equipped pieces belonging to others are reserved. */
export function recommendCharacterEquipment(
  account: AccountSnapshot,
  characterKey: string,
  builds: readonly BuildConfiguration[],
  profiles: readonly ScoreProfile[],
  context: RelicScoringContext
): EquipmentRecommendation {
  const character = account.characters.find(
    (entry) => entry.key === characterKey
  );
  if (!character) throw new Error(`Unknown Character ${characterKey}`);
  const active = availableRecommendationBuilds(
    account,
    character.definitionId,
    builds
  );
  if (
    active.filter((build) => build.category === "cavern").length > 1 ||
    active.filter((build) => build.category === "planar").length > 1
  ) {
    throw new Error("Choose one build per Relic category");
  }
  const current: EquipmentRecommendation["current"] = {};
  const selected: EquipmentRecommendation["selected"] = {};
  let currentSetComplete = active.length === 2;
  for (const build of active) {
    const profile = profiles.find((entry) => entry.id === build.scoreProfileId);
    if (!profile)
      throw new Error(`Missing Score Profile ${build.scoreProfileId}`);
    const slots = BUILD_SLOT_ORDER.filter(
      (slot) => relicCategory(slot) === build.category
    );
    for (const relic of account.relics.filter(
      (entry) =>
        entry.equippedCharacterKey === characterKey &&
        slots.includes(entry.slot)
    ))
      current[relic.slot] = {
        relic,
        score: scoreRelic(relic, profile, context, build),
      };
    const plans = assignments(build);
    currentSetComplete &&= plans.some((plan) =>
      slots.every((slot) => {
        const entry = current[slot];
        return (
          entry !== undefined &&
          entry.relic.setId === plan.get(slot) &&
          entry.score.mainStatAccepted
        );
      })
    );
    const candidates = account.relics
      .filter(
        (relic) =>
          relic.discarded !== true &&
          (!relic.equippedCharacterKey ||
            relic.equippedCharacterKey === characterKey) &&
          slots.includes(relic.slot) &&
          buildMainStats(build, relic.slot).includes(relic.mainStat.statId)
      )
      .map((relic) => ({
        relic,
        score: scoreRelic(relic, profile, context, build),
      }));
    const options = plans
      .map((plan) => {
        const result: EquipmentRecommendation["selected"] = {};
        for (const slot of slots) {
          const best = candidates
            .filter(
              (entry) =>
                entry.relic.slot === slot &&
                entry.relic.setId === plan.get(slot)
            )
            .sort(
              (left, right) =>
                right.score.total - left.score.total ||
                Number(right.relic.equippedCharacterKey === characterKey) -
                  Number(left.relic.equippedCharacterKey === characterKey) ||
                left.relic.key.localeCompare(right.relic.key)
            )[0];
          if (best) result[slot] = best;
        }
        return result;
      })
      .sort(
        (left, right) =>
          Object.keys(right).length - Object.keys(left).length ||
          sum(right) - sum(left) ||
          Object.values(right).filter(
            (entry) => entry.relic.equippedCharacterKey === characterKey
          ).length -
            Object.values(left).filter(
              (entry) => entry.relic.equippedCharacterKey === characterKey
            ).length
      );
    Object.assign(selected, options[0]);
  }
  const currentScore = Number((sum(current) / 6).toFixed(2));
  const recommendedScore = Number((sum(selected) / 6).toFixed(2));
  const missingSlots = BUILD_SLOT_ORDER.filter((slot) => !selected[slot]);
  return {
    characterKey,
    current,
    selected,
    missingSlots,
    changedSlots: BUILD_SLOT_ORDER.filter(
      (slot) =>
        selected[slot] && current[slot]?.relic.key !== selected[slot]?.relic.key
    ),
    currentScore,
    recommendedScore,
    scoreGain: Number((recommendedScore - currentScore).toFixed(2)),
    currentSetComplete,
    complete: missingSlots.length === 0,
  };
}

export type EquipRecommendationResult =
  | { status: "applied"; account: AccountSnapshot }
  | { status: "unavailable" };

/** Reconcile both equipment references, reserving every other Character's gear. */
export function equipRecommendedRelics(
  account: AccountSnapshot,
  characterKey: string,
  relicKeys: readonly string[]
): EquipRecommendationResult {
  const character = account.characters.find(
    (entry) => entry.key === characterKey
  );
  const selectedKeys = new Set(relicKeys);
  const relics = account.relics.filter((relic) => selectedKeys.has(relic.key));
  if (
    !character ||
    selectedKeys.size !== 6 ||
    relics.length !== 6 ||
    new Set(relics.map((relic) => relic.slot)).size !== 6 ||
    relics.some(
      (relic) =>
        relic.discarded === true ||
        (relic.equippedCharacterKey &&
          relic.equippedCharacterKey !== characterKey)
    )
  ) {
    return { status: "unavailable" };
  }
  return {
    status: "applied",
    account: AccountSnapshotSchema.parse({
      ...account,
      characters: account.characters.map((entry) =>
        entry.key === characterKey
          ? {
              ...entry,
              relicKeys: BUILD_SLOT_ORDER.flatMap((slot) =>
                relics
                  .filter((relic) => relic.slot === slot)
                  .map((relic) => relic.key)
              ),
            }
          : entry
      ),
      relics: account.relics.map((relic) => {
        if (selectedKeys.has(relic.key))
          return { ...relic, equippedCharacterKey: characterKey };
        if (relic.equippedCharacterKey !== characterKey) return relic;
        const { equippedCharacterKey: _owner, ...unequipped } = relic;
        return unequipped;
      }),
    }),
  };
}
