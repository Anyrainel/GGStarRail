import type { AbilityKind, EffectOrigin, HitDef } from "../kit/model";
import type { CombatType } from "../model/stats";
import type { DamageKind, DamageTag, TargetRole } from "../model/tags";
import type { AppliedModifier, DebuffChance } from "./units";

/** Break DoT families applied by Weakness Break, with their coefficients. */
export type BreakEffect =
  | "bleed"
  | "burn"
  | "frozen"
  | "shock"
  | "windShear"
  | "entanglement"
  | "imprisonment";

/**
 * One damage instance against one enemy, with everything damage evaluation
 * needs: who scales it, which modifiers were active, and the enemy state.
 * Records hold no relic-dependent numbers, so a log can be re-evaluated for
 * different equipment as long as the timeline is unchanged.
 */
export interface HitRecord {
  readonly time: number;
  readonly cycle: number;
  /** Unit that dealt the hit (Character, memosprite, or summon). */
  readonly attackerId: string;
  /** Unit whose stats scale the hit (summons use their owner). */
  readonly statUnitId: string;
  /** Unit whose scaling stat is multiplied (memosprite attacks on owner HP). */
  readonly scalingUnitId: string;
  readonly abilityId: string;
  readonly abilityKind: AbilityKind;
  readonly origin: EffectOrigin;
  readonly hit: HitDef;
  readonly role: TargetRole;
  readonly multiplier: number;
  readonly tags: readonly DamageTag[];
  readonly kind: DamageKind;
  readonly combatType: CombatType;
  readonly targetId: string;
  /** Expected occurrences (probability mass, detonation ratio included). */
  readonly weight: number;
  readonly attackerModifiers: readonly AppliedModifier[];
  /** Statuses on the scaling unit when it is not the stat unit. */
  readonly scalingModifiers?: readonly AppliedModifier[];
  readonly targetModifiers: readonly AppliedModifier[];
  readonly targetBroken: boolean;
  /** Target state when the hit landed, for target-state hit filters. */
  readonly targetWeaknesses: readonly CombatType[];
  /** Status IDs and `family:<name>` entries (see `HitDescriptor`). */
  readonly targetStatuses: readonly string[];
  readonly targetDebuffs: number;
  /** Break and Super Break inputs. */
  readonly toughnessReduced?: number;
  readonly maxToughness?: number;
  readonly breakEffect?: BreakEffect;
  /** Elation DMG: Punchline points counted at the hit. */
  readonly punchline?: number;
  /** DoT from a debuff applied with a base chance. */
  readonly chance?: DebuffChance;
}

export interface ActionRecord {
  readonly time: number;
  readonly cycle: number;
  readonly unitId: string;
  readonly abilityId: string;
  readonly abilityKind: AbilityKind;
  /** Whether it was an extra turn, a queued (follow-up) action, or a turn. */
  readonly mode: "turn" | "extraTurn" | "queued" | "ultimate";
  readonly skillPointsAfter: number;
  readonly energyAfter: number;
}

export interface CombatLog {
  readonly hits: readonly HitRecord[];
  readonly actions: readonly ActionRecord[];
  /** Action value elapsed when the simulation stopped. */
  readonly duration: number;
  readonly cycles: number;
  readonly warnings: readonly string[];
}
