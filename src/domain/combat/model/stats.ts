import type { CombatTypeId } from "@/domain/stats";
import { STAT_IDS } from "@/domain/stats";

/**
 * Every quantity a modifier can change. Panel stats describe a unit; the
 * remaining keys only exist while damage is resolved. Values are decimals
 * (0.12 = 12%) except flat HP/ATK/DEF/SPD.
 *
 * Holder semantics are fixed per key: outgoing keys are read from the
 * attacker, incoming keys from the unit being hit. A modifier never chooses
 * its own side, so a translation cannot place an enemy debuff on an ally.
 */
export const COMBAT_STATS = [
  // Panel: base values come from Character + Light Cone level scaling.
  "hpBase",
  "atkBase",
  "defBase",
  "spdBase",
  "hpPct",
  "atkPct",
  "defPct",
  "spdPct",
  "hpFlat",
  "atkFlat",
  "defFlat",
  "spdFlat",
  "critRate",
  "critDmg",
  "breakEffect",
  "effectHitRate",
  "effectRes",
  "energyRegen",
  "outgoingHealing",
  "elation",
  /** Chance of being targeted, as a % of base aggro (Taunt-like buffs). */
  "aggroPct",
  // Outgoing damage modifiers, read from the attacker.
  "dmgBoost",
  "resPen",
  "defIgnore",
  "dmgMultiplier",
  "trueDmg",
  "breakEfficiency",
  "superBreakDmg",
  "multiplierBoost",
  "merrymaking",
  // Incoming modifiers, read from the unit that takes the hit.
  "vulnerability",
  "defReduction",
  "resReduction",
  "dmgMitigation",
] as const;

export type CombatStat = (typeof COMBAT_STATS)[number];

export const INCOMING_STATS: ReadonlySet<CombatStat> = new Set([
  "vulnerability",
  "defReduction",
  "resReduction",
  "dmgMitigation",
]);

/**
 * `product` keys combine as (1+a)(1+b)-1: independent multiplier zones such
 * as "deals DMG equal to 115% of the original DMG". Mitigation combines as
 * 1-(1-a)(1-b) and is stored the same way with negated sign handling.
 */
export const PRODUCT_STATS: ReadonlySet<CombatStat> = new Set([
  "dmgMultiplier",
]);
export const COMPLEMENT_STATS: ReadonlySet<CombatStat> = new Set([
  "dmgMitigation",
]);

export const STAT_COUNT = COMBAT_STATS.length;

export const STAT_INDEX = Object.fromEntries(
  COMBAT_STATS.map((stat, index) => [stat, index])
) as Readonly<Record<CombatStat, number>>;

/** Dense stat storage; index with `STAT_INDEX`. */
export type StatVector = Float64Array;

export function newStatVector(): StatVector {
  return new Float64Array(STAT_COUNT);
}

export function combineStat(
  vector: StatVector,
  stat: CombatStat,
  value: number
): void {
  const index = STAT_INDEX[stat];
  const current = vector[index] ?? 0;
  if (PRODUCT_STATS.has(stat)) {
    vector[index] = (1 + current) * (1 + value) - 1;
  } else if (COMPLEMENT_STATS.has(stat)) {
    vector[index] = 1 - (1 - current) * (1 - value);
  } else {
    vector[index] = current + value;
  }
}

export function readStat(vector: StatVector, stat: CombatStat): number {
  return vector[STAT_INDEX[stat]] ?? 0;
}

export type ScalingStat = "hp" | "atk" | "def" | "spd";

/** Final HP/ATK/DEF/SPD = base × (1 + %) + flat. */
export function finalStat(vector: StatVector, stat: ScalingStat): number {
  const base = vector[STAT_INDEX[`${stat}Base`]] ?? 0;
  const pct = vector[STAT_INDEX[`${stat}Pct`]] ?? 0;
  const flat = vector[STAT_INDEX[`${stat}Flat`]] ?? 0;
  return base * (1 + pct) + flat;
}

/** Combat Type names used by kits; the bundle calls Lightning `Thunder`. */
export type CombatType = CombatTypeId;

export interface PropertyStatMapping {
  stat: CombatStat;
  combatType?: CombatType;
}

/**
 * Game property IDs that appear in Relics, Trace bonuses, Light Cone and set
 * data. Elemental DMG Boosts are generic DMG Boost scoped to a Combat Type.
 */
export const PROPERTY_STAT: Readonly<Record<string, PropertyStatMapping>> = {
  [STAT_IDS.hp]: { stat: "hpFlat" },
  [STAT_IDS.hpPercent]: { stat: "hpPct" },
  [STAT_IDS.atk]: { stat: "atkFlat" },
  [STAT_IDS.atkPercent]: { stat: "atkPct" },
  [STAT_IDS.def]: { stat: "defFlat" },
  [STAT_IDS.defPercent]: { stat: "defPct" },
  [STAT_IDS.spd]: { stat: "spdFlat" },
  [STAT_IDS.baseSpd]: { stat: "spdFlat" },
  SpeedAddedRatio: { stat: "spdPct" },
  [STAT_IDS.critRate]: { stat: "critRate" },
  [STAT_IDS.critDmg]: { stat: "critDmg" },
  [STAT_IDS.breakEffect]: { stat: "breakEffect" },
  [STAT_IDS.outgoingHealing]: { stat: "outgoingHealing" },
  [STAT_IDS.energyRegenRate]: { stat: "energyRegen" },
  [STAT_IDS.effectHitRate]: { stat: "effectHitRate" },
  [STAT_IDS.effectRes]: { stat: "effectRes" },
  [STAT_IDS.elation]: { stat: "elation" },
  AllDamageTypeAddedRatio: { stat: "dmgBoost" },
  [STAT_IDS.physicalDmg]: { stat: "dmgBoost", combatType: "Physical" },
  [STAT_IDS.fireDmg]: { stat: "dmgBoost", combatType: "Fire" },
  [STAT_IDS.iceDmg]: { stat: "dmgBoost", combatType: "Ice" },
  [STAT_IDS.lightningDmg]: { stat: "dmgBoost", combatType: "Thunder" },
  [STAT_IDS.windDmg]: { stat: "dmgBoost", combatType: "Wind" },
  [STAT_IDS.quantumDmg]: { stat: "dmgBoost", combatType: "Quantum" },
  [STAT_IDS.imaginaryDmg]: { stat: "dmgBoost", combatType: "Imaginary" },
};
