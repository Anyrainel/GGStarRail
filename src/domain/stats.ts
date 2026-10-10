import type { RelicSlot } from "@/domain/account/schemas";

/**
 * HSR property IDs used by Relic affixes, Trace bonuses, Light Cone effects,
 * and account snapshots. Stored records keep the plain string so newly
 * released properties remain additive data; code that needs a specific
 * property names it through this table instead of repeating literals.
 */
export const STAT_IDS = {
  hp: "HPDelta",
  hpPercent: "HPAddedRatio",
  atk: "AttackDelta",
  atkPercent: "AttackAddedRatio",
  def: "DefenceDelta",
  defPercent: "DefenceAddedRatio",
  spd: "SpeedDelta",
  baseSpd: "BaseSpeed",
  critRate: "CriticalChanceBase",
  critDmg: "CriticalDamageBase",
  breakEffect: "BreakDamageAddedRatioBase",
  outgoingHealing: "HealRatioBase",
  energyRegenRate: "SPRatioBase",
  effectHitRate: "StatusProbabilityBase",
  effectRes: "StatusResistanceBase",
  elation: "ElationDamageAddedRatioBase",
  physicalDmg: "PhysicalAddedRatio",
  fireDmg: "FireAddedRatio",
  iceDmg: "IceAddedRatio",
  lightningDmg: "ThunderAddedRatio",
  windDmg: "WindAddedRatio",
  quantumDmg: "QuantumAddedRatio",
  imaginaryDmg: "ImaginaryAddedRatio",
} as const;

export type StatId = (typeof STAT_IDS)[keyof typeof STAT_IDS];

/** Combat Type IDs from the reference bundle (Lightning is `Thunder`). */
export type CombatTypeId =
  | "Physical"
  | "Fire"
  | "Ice"
  | "Thunder"
  | "Wind"
  | "Quantum"
  | "Imaginary";

export const DMG_BOOST_STAT_BY_COMBAT_TYPE = {
  Physical: STAT_IDS.physicalDmg,
  Fire: STAT_IDS.fireDmg,
  Ice: STAT_IDS.iceDmg,
  Thunder: STAT_IDS.lightningDmg,
  Wind: STAT_IDS.windDmg,
  Quantum: STAT_IDS.quantumDmg,
  Imaginary: STAT_IDS.imaginaryDmg,
} as const satisfies Record<CombatTypeId, StatId>;

export function isCombatTypeId(value: string): value is CombatTypeId {
  return Object.hasOwn(DMG_BOOST_STAT_BY_COMBAT_TYPE, value);
}

/** Relic slot IDs as named by the reference bundle and game data. */
export type CatalogRelicSlotId =
  | "HEAD"
  | "HAND"
  | "BODY"
  | "FOOT"
  | "NECK"
  | "OBJECT";

export const CATALOG_RELIC_SLOT = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, CatalogRelicSlotId>;

export const RELIC_SLOT_BY_CATALOG_SLOT = {
  HEAD: "head",
  HAND: "hands",
  BODY: "body",
  FOOT: "feet",
  NECK: "planarSphere",
  OBJECT: "linkRope",
} as const satisfies Record<CatalogRelicSlotId, RelicSlot>;

/** Head and Hands always roll these main stats. */
export const FIXED_MAIN_STAT = {
  head: STAT_IDS.hp,
  hands: STAT_IDS.atk,
} as const satisfies Partial<Record<RelicSlot, StatId>>;

export type StatValueKind = "flat" | "ratio" | "unknown";

/**
 * Account snapshots store ratio properties as display percentage points
 * (6.4 = 6.4%); generated tables and combat math use decimals (0.064).
 */
export function accountStatToDecimal(
  value: number,
  valueKind: StatValueKind
): number {
  return valueKind === "ratio" ? value / 100 : value;
}

export function decimalToAccountStat(
  value: number,
  valueKind: StatValueKind
): number {
  return valueKind === "ratio" ? value * 100 : value;
}
