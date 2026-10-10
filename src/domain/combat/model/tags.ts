import type { CombatStat, CombatType } from "./stats";

/**
 * DMG types named by game text. A hit carries every type the text assigns
 * ("this DMG is considered Ultimate DMG" adds `ultimate`). `memosprite`
 * marks DMG dealt by a memosprite's abilities.
 */
export const DAMAGE_TAGS = [
  "basic",
  "skill",
  "ultimate",
  "followUp",
  "dot",
  "additional",
  "memosprite",
  "elation",
  "joint",
  "technique",
  "break",
  "superBreak",
] as const;

export type DamageTag = (typeof DAMAGE_TAGS)[number];

/**
 * The formula family that resolves a hit.
 * - `direct`: ability DMG, Additional DMG, Technique DMG (crit applies).
 * - `dot`: character DoTs such as Shock or Bleed from a kit (no crit).
 * - `break`: Weakness Break DMG and the Break DoT it applies.
 * - `superBreak`: Super Break DMG from Toughness reduction.
 * - `elation`: Elation DMG.
 * - `fixed`: True DMG and other flat amounts that skip every zone.
 */
export type DamageKind =
  | "direct"
  | "dot"
  | "break"
  | "superBreak"
  | "elation"
  | "fixed";

/** Which unit families a modifier reaches when it is evaluated. */
export type UnitKind = "character" | "memosprite" | "summon" | "enemy";

/**
 * Scope of a modifier. Omitted dimensions match everything, except that
 * Break-family hits (`break`, `superBreak`) only receive DMG Boost, DMG
 * multiplier, and True DMG modifiers whose filter names `break` or
 * `superBreak`: game text that boosts "DMG dealt" never boosts Break DMG.
 * Vulnerability, DEF, and RES modifiers reach Break DMG normally.
 */
export interface HitFilter {
  /** Matches when the hit carries any listed tag. */
  tags?: readonly DamageTag[];
  combatTypes?: readonly CombatType[];
  /** Restricts to hits dealt by these unit kinds (default: any). */
  attackerKinds?: readonly UnitKind[];
  /** Only against targets weak to any of these Combat Types. */
  targetWeakness?: readonly CombatType[];
}

export interface HitDescriptor {
  tags: readonly DamageTag[];
  kind: DamageKind;
  combatType: CombatType;
  attackerKind: UnitKind;
  targetWeaknesses: ReadonlySet<CombatType>;
}

const BREAK_TAGS: ReadonlySet<DamageTag> = new Set(["break", "superBreak"]);

export function isBreakFamily(kind: DamageKind): boolean {
  return kind === "break" || kind === "superBreak";
}

const BREAK_EXPLICIT_STATS: ReadonlySet<CombatStat> = new Set([
  "dmgBoost",
  "dmgMultiplier",
  "trueDmg",
]);

export function modifierApplies(
  stat: CombatStat,
  filter: HitFilter | undefined,
  hit: HitDescriptor
): boolean {
  if (isBreakFamily(hit.kind) && BREAK_EXPLICIT_STATS.has(stat)) {
    const namesBreak =
      filter?.tags?.some((tag) => BREAK_TAGS.has(tag)) ?? false;
    if (!namesBreak) return false;
  }
  return filterMatches(filter, hit);
}

export function filterMatches(
  filter: HitFilter | undefined,
  hit: HitDescriptor
): boolean {
  if (!filter) return true;
  if (filter.tags && !filter.tags.some((tag) => hit.tags.includes(tag))) {
    return false;
  }
  if (filter.combatTypes && !filter.combatTypes.includes(hit.combatType)) {
    return false;
  }
  if (
    filter.attackerKinds &&
    !filter.attackerKinds.includes(hit.attackerKind)
  ) {
    return false;
  }
  if (
    filter.targetWeakness &&
    !filter.targetWeakness.some((type) => hit.targetWeaknesses.has(type))
  ) {
    return false;
  }
  return true;
}
