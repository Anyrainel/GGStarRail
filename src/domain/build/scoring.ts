import type { Relic, RelicSlot } from "@/domain/account/schemas";
import type { BuildConfiguration, ScoreProfile } from "./schemas";

export type ScoreGrade = "S" | "A" | "B" | "C" | "D";

export interface StatScoreContribution {
  normalizedRolls: number;
  weight: number;
  score: number;
}

export interface RelicScore {
  total: number;
  /** Null means the piece has an off-target configurable main stat. */
  grade: ScoreGrade | null;
  mainStatAccepted: boolean;
  mainStatScore: number;
  substatScore: number;
  normalizedRolls: number;
  weightedRolls: number;
  maximumWeightedRolls: number;
  contributions: Record<string, StatScoreContribution>;
}

export interface RelicScoringContext {
  properties: ReadonlyMap<
    string,
    { id: string; value_kind: "flat" | "ratio" | "unknown" }
  >;
  relicPieces: ReadonlyMap<
    string,
    {
      id: string;
      main_affix_group: number;
      sub_affix_group: number;
      max_level: number;
    }
  >;
  mainAffixes: readonly {
    group_id: number;
    property_id: string;
    max_level: number;
    level_values: readonly number[];
  }[];
  subAffixes: readonly {
    group_id: number;
    property_id: string;
    roll_values: readonly number[];
  }[];
}

type ScoringProperty =
  RelicScoringContext["properties"] extends ReadonlyMap<string, infer T>
    ? T
    : never;

type ScoringRelicPiece =
  RelicScoringContext["relicPieces"] extends ReadonlyMap<string, infer T>
    ? T
    : never;

const FIXED_MAIN_STATS: Partial<Record<RelicSlot, string>> = {
  head: "HPDelta",
  hands: "AttackDelta",
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

/** Account ratios use percentage points while generated affixes use decimals. */
export function toGeneratedStatValue(
  value: number,
  property: ScoringProperty
): number {
  return property.value_kind === "ratio" ? value / 100 : value;
}

export function gradeScore(
  score: number,
  thresholds: ScoreProfile["gradeThresholds"]
): ScoreGrade {
  if (score >= thresholds.s) return "S";
  if (score >= thresholds.a) return "A";
  if (score >= thresholds.b) return "B";
  if (score >= thresholds.c) return "C";
  return "D";
}

function mainStatAllowed(
  relic: Relic,
  build: BuildConfiguration | undefined
): boolean {
  const fixed = FIXED_MAIN_STATS[relic.slot];
  if (fixed) return relic.mainStat.statId === fixed;
  if (!build) return true;
  if (relic.slot === "body") {
    return build.preferredMainStats.body.includes(relic.mainStat.statId);
  }
  if (relic.slot === "feet") {
    return build.preferredMainStats.feet.includes(relic.mainStat.statId);
  }
  if (relic.slot === "planarSphere") {
    return build.preferredMainStats.planarSphere.includes(
      relic.mainStat.statId
    );
  }
  return build.preferredMainStats.linkRope.includes(relic.mainStat.statId);
}

function mainStatProgress(
  relic: Relic,
  piece: ScoringRelicPiece,
  context: RelicScoringContext
): number {
  const affix = context.mainAffixes.find(
    (candidate) =>
      candidate.group_id === piece.main_affix_group &&
      candidate.property_id === relic.mainStat.statId &&
      candidate.max_level === piece.max_level
  );
  const generated = affix?.level_values[relic.level];
  const maximum = affix?.level_values[piece.max_level];
  if (
    generated === undefined ||
    !Number.isFinite(generated) ||
    generated < 0 ||
    maximum === undefined ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    return 0;
  }
  return clamp(generated / maximum, 0, 1);
}

function maximumWeightedRolls(
  relic: Relic,
  piece: ScoringRelicPiece,
  profile: ScoreProfile,
  context: RelicScoringContext
): number {
  const initialLines = Math.max(0, Math.min(4, relic.rarity - 1));
  const upgradeRolls = Math.floor(piece.max_level / 3);
  const eligibleWeights = context.subAffixes
    .filter(
      (affix) =>
        affix.group_id === piece.sub_affix_group &&
        affix.property_id !== relic.mainStat.statId
    )
    .map((affix) => profile.statWeights[affix.property_id] ?? 0)
    .sort((left, right) => right - left)
    .slice(0, initialLines);
  if (eligibleWeights.length === 0) return 0;
  return eligibleWeights.reduce(
    (total, weight, index) =>
      total + weight * (index === 0 ? 1 + upgradeRolls : 1),
    0
  );
}

function normalizedSubstatRolls(
  statId: string,
  value: number,
  piece: ScoringRelicPiece,
  context: RelicScoringContext
): number {
  const property = context.properties.get(statId);
  const affix = context.subAffixes.find(
    (candidate) =>
      candidate.group_id === piece.sub_affix_group &&
      candidate.property_id === statId
  );
  const maximumRoll = affix?.roll_values.at(-1);
  if (!property || !maximumRoll || maximumRoll <= 0) return 0;
  return Math.max(0, toGeneratedStatValue(value, property) / maximumRoll);
}

export function scoreRelic(
  relic: Relic,
  profile: ScoreProfile,
  context: RelicScoringContext,
  build?: BuildConfiguration
): RelicScore {
  const piece = context.relicPieces.get(relic.definitionId);
  const mainProperty = context.properties.get(relic.mainStat.statId);
  if (!piece || !mainProperty) {
    throw new Error(
      `Missing scoring reference for Relic ${relic.definitionId}`
    );
  }

  const contributions: Record<string, StatScoreContribution> = {};
  let normalizedRolls = 0;
  let weightedRolls = 0;
  const maximumPotential = maximumWeightedRolls(relic, piece, profile, context);

  for (const stat of relic.substats) {
    const rolls = normalizedSubstatRolls(
      stat.statId,
      stat.value,
      piece,
      context
    );
    const weight = profile.statWeights[stat.statId] ?? 0;
    const weighted = rolls * weight;
    normalizedRolls += rolls;
    weightedRolls += weighted;
    contributions[stat.statId] = {
      normalizedRolls: roundScore(rolls),
      weight,
      score:
        maximumPotential > 0
          ? roundScore((weighted / maximumPotential) * 100)
          : 0,
    };
  }

  const substatScore =
    maximumPotential > 0
      ? clamp((weightedRolls / maximumPotential) * 100, 0, 100)
      : 0;
  const mainStatAccepted = mainStatAllowed(relic, build);
  const mainStatScore = mainStatAccepted
    ? mainStatProgress(relic, piece, context) * 100
    : 0;
  const mainWeight = profile.includeMainStat ? profile.mainStatWeight : 0;
  const total = mainStatScore * mainWeight + substatScore * (1 - mainWeight);

  return {
    total: roundScore(total),
    grade: mainStatAccepted ? gradeScore(total, profile.gradeThresholds) : null,
    mainStatAccepted,
    mainStatScore: roundScore(mainStatScore),
    substatScore: roundScore(substatScore),
    normalizedRolls: roundScore(normalizedRolls),
    weightedRolls: roundScore(weightedRolls),
    maximumWeightedRolls: roundScore(maximumPotential),
    contributions,
  };
}
