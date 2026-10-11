/**
 * Character Traces are keyed by catalog trace point IDs, which the game forms
 * as `${characterId}${suffix}`. Ability nodes hold the base level reported by
 * the source (Eidolon level bonuses are not included); Bonus Ability and Stat
 * Bonus nodes hold 1 when unlocked and 0 when the source reports them locked.
 * A missing key means the source did not report that node.
 */
export const ABILITY_TRACE_SUFFIX = {
  basic: "001",
  skill: "002",
  ultimate: "003",
  talent: "004",
  technique: "007",
  memospriteSkill: "301",
  memospriteTalent: "302",
  elationSkill: "420",
} as const;

export type AbilityTraceKind = keyof typeof ABILITY_TRACE_SUFFIX;

export const BONUS_ABILITY_COUNT = 3;
export const STAT_BONUS_COUNT = 10;

export function abilityTraceId(
  characterId: string,
  kind: AbilityTraceKind
): string {
  return `${characterId}${ABILITY_TRACE_SUFFIX[kind]}`;
}

/** Bonus Abilities are the A2/A4/A6 nodes, numbered 1..3 in tree order. */
export function bonusAbilityTraceId(
  characterId: string,
  index: number
): string {
  if (!Number.isInteger(index) || index < 1 || index > BONUS_ABILITY_COUNT) {
    throw new Error(`Invalid Bonus Ability index ${index}`);
  }
  return `${characterId}${100 + index}`;
}

/** Stat Bonus nodes are numbered 1..10 in tree order. */
export function statBonusTraceId(characterId: string, index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > STAT_BONUS_COUNT) {
    throw new Error(`Invalid Stat Bonus index ${index}`);
  }
  return `${characterId}${200 + index}`;
}
