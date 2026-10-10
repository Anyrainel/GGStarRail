import type { CombatStat, CombatType, ScalingStat } from "../model/stats";
import type {
  DamageKind,
  DamageTag,
  HitFilter,
  StatusFamily,
} from "../model/tags";

/**
 * Where an effect comes from, for the buff ledger and damage breakdowns.
 * Codes mirror in-game labels: abilities, Bonus Abilities (A2/A4/A6),
 * Eidolons (E1–E6), and equipment.
 */
export type EffectOrigin =
  | "basic"
  | "skill"
  | "ultimate"
  | "talent"
  | "technique"
  | "memospriteSkill"
  | "memospriteTalent"
  | "elationSkill"
  | "a2"
  | "a4"
  | "a6"
  | "e1"
  | "e2"
  | "e4"
  | "e6"
  | "traceStats"
  | "lightCone"
  | "relic2pc"
  | "relic4pc"
  | "ornament"
  | "scenario";

/** Stats a scaling modifier can read. HP/ATK/DEF/SPD resolve to finals. */
export type ReadableStat = ScalingStat | CombatStat | "maxEnergy";

/**
 * "Increases X by Y% of Z": value = ratio × max(0, Z − threshold), floored
 * to `step` units when given, and capped. `source` chooses whose Z is read:
 * the holder of the modifier or the unit that applied it.
 *
 * Scaling inputs are read before any scaling modifier is applied, so
 * conversions never feed other conversions. An applier's stats are its
 * steady combat panel (base, equipment, permanent effects) rather than its
 * momentary statuses.
 */
export interface StatScaling {
  source: "holder" | "applier";
  stat: ReadableStat;
  ratio: number;
  threshold?: number;
  step?: number;
  cap?: number;
  /**
   * Threshold form: "when X reaches N or higher, ..." grants exactly
   * `ratio` once the stat is at least `atLeast` (other fields unused).
   */
  atLeast?: number;
}

export interface ModifierDef {
  stat: CombatStat;
  /** Constant part (per stack on a stacking status). */
  value?: number;
  scaling?: StatScaling;
  filter?: HitFilter;
}

/** Whose turns count down a status, and when. */
export interface TurnDuration {
  turns: number;
  /** Default `turnEnd`: the turn in which it was applied counts. */
  countdown?: "turnStart" | "turnEnd";
  /** Default `holder`. Some text counts the applier's turns instead. */
  clock?: "holder" | "applier";
}

/** DoT ticks at the start of the holder's (enemy's) turn. */
export interface DotDef {
  hit: HitDef;
  /** Base chance for the DoT to be applied; scales expected damage. */
  baseChance?: number;
}

export interface StatusDef {
  id: string;
  origin: EffectOrigin;
  /** Omit for effects that last until removed. */
  duration?: TurnDuration;
  maxStacks?: number;
  modifiers?: readonly ModifierDef[];
  /** A debuff that deals DoT DMG; DoT detonation reads this definition. */
  dot?: DotDef;
  /** Debuff (on enemies) vs buff; debuffs count for "per debuff" effects. */
  debuff?: boolean;
  /**
   * "Effects of the same type cannot stack": copies of this status from
   * different appliers do not add up; only the strongest applies.
   */
  unique?: boolean;
  /** Generic identity named by game text ("Burned", "Slowed"). */
  family?: StatusFamily;
  /**
   * Control effects (Frozen, Imprisonment-like "cannot act") make the
   * holder skip its turn. A base-chance application skips in expectation.
   */
  skipsTurn?: boolean;
}

/**
 * `split`: one multiplier "distributed evenly across all enemies"; each
 * enemy takes `main / enemies` and its own Toughness reduction.
 */
export type TargetShape = "single" | "blast" | "aoe" | "bounce" | "split";

/**
 * One damage instance of an ability. Multipliers are per target role:
 * `main` for the designated target, `adjacent` for Blast neighbours, and
 * `each` for every enemy of an AoE or each Bounce instance. An AoE with
 * both deals `main` to the designated target and `each` to the others.
 */
export interface HitDef {
  shape: TargetShape;
  main?: number;
  adjacent?: number;
  each?: number;
  /** Bounce instances (shape `bounce`). */
  bounces?: number;
  /** Scaling stat; default `atk`. */
  stat?: ScalingStat;
  /** Read the scaling stat from the owner (memosprite attacks scaling on the owner). */
  statOwner?: "self" | "owner";
  kind?: DamageKind;
  /** Tags added to the ability's own tags. */
  tags?: readonly DamageTag[];
  /** Replace the ability's tags entirely ("this DMG is not considered..."). */
  onlyTags?: readonly DamageTag[];
  combatType?: CombatType;
  /** Displayed Toughness reduction per target role. */
  toughness?: { main?: number; adjacent?: number; each?: number };
  /**
   * Toughness reduction against enemies without the matching Weakness, as
   * a fraction of the normal amount ("can reduce Toughness regardless of
   * Weakness Type" is 1). Default 0.
   */
  toughnessWithoutWeakness?: number;
  /**
   * No `hit` event for this instance: a second scaling part of the same
   * damage (e.g. "ATK% + Max HP%") must not trigger per-hit effects twice.
   */
  silent?: boolean;
  /** Fixed CRIT Rate/CRIT DMG used instead of the attacker's ("Robin"). */
  critOverride?: { critRate: number; critDmg: number };
  /**
   * Direct hits worded "(X × Elation + Y%) of ATK": X is added to the
   * multiplier per point of Elation.
   */
  elationScaling?: number;
  /**
   * Elation DMG: Punchline taken into account. Default is the team's
   * current Punchline; Certified Banger procs pass the state's value and
   * Aha extra turns pass their fixed amount.
   */
  punchline?: number;
}

export type AbilityKind =
  | "basic"
  | "skill"
  | "ultimate"
  | "followUp"
  | "memospriteSkill"
  | "elationSkill"
  | "talent"
  | "other";

export const DEFAULT_ABILITY_TAGS: Readonly<
  Record<AbilityKind, readonly DamageTag[]>
> = {
  basic: ["basic"],
  skill: ["skill"],
  ultimate: ["ultimate"],
  followUp: ["followUp"],
  memospriteSkill: ["memosprite"],
  elationSkill: ["elation"],
  talent: [],
  other: [],
};

/** Energy and Skill Point conventions used when an ability omits them. */
export const DEFAULT_ENERGY: Readonly<Partial<Record<AbilityKind, number>>> = {
  basic: 20,
  skill: 30,
  ultimate: 5,
  elationSkill: 5,
};
export const DEFAULT_SKILL_POINTS: Readonly<
  Partial<Record<AbilityKind, number>>
> = {
  basic: 1,
  skill: -1,
};

export type AbilityTarget = "enemy" | "ally" | "self" | "allies" | "none";
