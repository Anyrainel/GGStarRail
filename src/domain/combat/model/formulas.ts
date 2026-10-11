import type { CombatType } from "./stats";

/**
 * Attacker-level base ("level multiplier") for Break, Super Break, Break
 * DoT, and (doubled) Elation DMG, levels 1–80. Data-mined values agree
 * across independent sources; see docs/combat/mechanics.md.
 */
const BREAK_LEVEL_BASE: readonly number[] = [
  54, 58, 62, 67.5264, 70.5094, 73.5228, 76.566, 79.6385, 82.7395, 85.8684,
  91.4944, 97.068, 102.5892, 108.0579, 113.4743, 118.8383, 124.1499, 129.4091,
  134.6159, 139.7703, 149.3323, 158.8011, 168.1768, 177.4594, 186.6489,
  195.7452, 204.7484, 213.6585, 222.4754, 231.1992, 246.4276, 261.181, 275.4733,
  289.3179, 302.7275, 315.7144, 328.2905, 340.4671, 352.2554, 363.6658, 408.124,
  451.7883, 494.6798, 536.8188, 578.2249, 618.9172, 658.9138, 698.2325,
  736.8905, 774.9041, 871.0599, 964.8705, 1056.4206, 1145.791, 1233.0585,
  1318.2965, 1401.575, 1482.9608, 1562.5178, 1640.3068, 1752.3215, 1861.9011,
  1969.1242, 2074.0659, 2176.7983, 2277.3904, 2375.9085, 2472.416, 2566.9739,
  2659.6406, 2780.3044, 2898.6022, 3014.6029, 3128.3729, 3239.9758, 3349.473,
  3456.9236, 3562.3843, 3665.9099, 3767.5533,
];

export function breakLevelBase(attackerLevel: number): number {
  const level = Math.min(
    Math.max(Math.round(attackerLevel), 1),
    BREAK_LEVEL_BASE.length
  );
  return BREAK_LEVEL_BASE[level - 1] ?? 0;
}
/** Weakness Break DMG coefficient of the breaking Combat Type. */
export const BREAK_COEFFICIENT: Readonly<Record<CombatType, number>> = {
  Physical: 2,
  Fire: 2,
  Ice: 1,
  Thunder: 1,
  Wind: 1.5,
  Quantum: 0.5,
  Imaginary: 0.5,
};

/** Max Toughness in displayed units (a Basic ATK typically deals 10). */
export function toughnessFactor(maxToughness: number): number {
  return 0.5 + maxToughness / 40;
}

export function enemyDef(enemyLevel: number): number {
  return 200 + 10 * enemyLevel;
}

/**
 * DEF multiplier for an attacker hitting an enemy. DEF reduction on the
 * enemy and DEF ignore on the attacker sum into one bucket floored at 0.
 */
export function defMultiplier(
  attackerLevel: number,
  enemyLevel: number,
  defShred: number
): number {
  const attacker = attackerLevel + 20;
  return attacker / ((enemyLevel + 20) * Math.max(0, 1 - defShred) + attacker);
}

/** Effective RES (RES − RES reduction − RES PEN) is clamped to [−100%, 90%]. */
export function resMultiplier(resistance: number, penetration: number): number {
  return 1 - Math.min(0.9, Math.max(-1, resistance - penetration));
}

export type CritMode = "expected" | "crit" | "nonCrit";

export function critMultiplier(
  critRate: number,
  critDmg: number,
  mode: CritMode
): number {
  if (mode === "crit") return 1 + critDmg;
  if (mode === "nonCrit") return 1;
  const rate = Math.min(1, Math.max(0, critRate));
  return 1 + rate * critDmg;
}

/** Toughness grants 10% DMG reduction until the enemy is Weakness Broken. */
export function toughnessMitigation(broken: boolean): number {
  return broken ? 1 : 0.9;
}

/** Chance that a debuff with base chance lands on an enemy. */
export function effectHitChance(
  baseChance: number,
  effectHitRate: number,
  effectRes: number,
  debuffRes = 0
): number {
  const chance =
    baseChance * (1 + effectHitRate) * (1 - effectRes) * (1 - debuffRes);
  return Math.min(1, Math.max(0, chance));
}

/** Action value until the next turn at a given SPD. */
export function actionValue(speed: number): number {
  return 10_000 / Math.max(speed, 1e-6);
}
