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
  "assist",
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

/** Where a hit landed relative to the ability's designated target. */
export type TargetRole = "main" | "adjacent" | "each";

/**
 * Shared identities of statuses that game text names generically ("Burned
 * enemies", "Slowed"). Kits tag their statuses with a family so effects can
 * see the same family from Weakness Break and from other Characters.
 */
export const STATUS_FAMILIES = [
  "burn",
  "shock",
  "bleed",
  "windShear",
  "frozen",
  "entanglement",
  "imprisonment",
  "slow",
  /** Shields on allies, from any source ("while Shielded"). */
  "shield",
  /** Derived: any status that lowers its holder's DEF. */
  "defReduced",
] as const;

export type StatusFamily = (typeof STATUS_FAMILIES)[number];

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
  /** Only against targets holding any of these statuses (by status ID). */
  targetStatuses?: readonly string[];
  /** Only against targets holding a status of any of these families. */
  targetFamilies?: readonly StatusFamily[];
  /** Only against targets with at least this many debuffs. */
  minTargetDebuffs?: number;
  /** Only against targets with at least this many DoTs. */
  minTargetDots?: number;
  /** Only against Weakness Broken (true) or unbroken (false) targets. */
  targetBroken?: boolean;
  /** Only hits on these target roles (e.g. the main target of a Blast). */
  targetRoles?: readonly TargetRole[];
}

/** The hit as filters see it; target state is captured when it landed. */
export interface HitDescriptor {
  tags: readonly DamageTag[];
  kind: DamageKind;
  combatType: CombatType;
  attackerKind: UnitKind;
  role: TargetRole;
  targetWeaknesses: ReadonlySet<CombatType>;
  /** Status IDs and `family:<name>` entries present on the target. */
  targetStatuses: ReadonlySet<string>;
  targetDebuffs: number;
  targetDots: number;
  targetBroken: boolean;
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
  if (
    filter.targetStatuses &&
    !filter.targetStatuses.some((id) => hit.targetStatuses.has(id))
  ) {
    return false;
  }
  if (
    filter.targetFamilies &&
    !filter.targetFamilies.some((family) =>
      hit.targetStatuses.has(`family:${family}`)
    )
  ) {
    return false;
  }
  if (
    filter.minTargetDebuffs !== undefined &&
    hit.targetDebuffs < filter.minTargetDebuffs
  ) {
    return false;
  }
  if (
    filter.minTargetDots !== undefined &&
    hit.targetDots < filter.minTargetDots
  ) {
    return false;
  }
  if (
    filter.targetBroken !== undefined &&
    filter.targetBroken !== hit.targetBroken
  ) {
    return false;
  }
  if (filter.targetRoles && !filter.targetRoles.includes(hit.role)) {
    return false;
  }
  return true;
}
