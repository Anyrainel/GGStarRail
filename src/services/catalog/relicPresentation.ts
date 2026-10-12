import {
  type Relic,
  type RelicCategory,
  type RelicSlot,
  relicCategory,
} from "@/domain/account/schemas";
import type { MessageKey } from "@/i18n/messages.en";

/** Account-level Relic slot IDs: four Cavern Relics, then two Planar Ornaments. */
export type RelicSlotId = RelicSlot;
export type RelicKind = RelicCategory;

export const CAVERN_SLOTS = [
  "head",
  "hands",
  "body",
  "feet",
] as const satisfies readonly RelicSlotId[];

export const PLANAR_SLOTS = [
  "planarSphere",
  "linkRope",
] as const satisfies readonly RelicSlotId[];

export const RELIC_SLOTS = [
  ...CAVERN_SLOTS,
  ...PLANAR_SLOTS,
] as const satisfies readonly RelicSlotId[];

export function relicSlotsOfKind(kind: RelicKind): readonly RelicSlotId[] {
  return kind === "cavern" ? CAVERN_SLOTS : PLANAR_SLOTS;
}

const SHORT_STAT_KEYS: Readonly<Record<string, MessageKey>> = {
  MaxHP: "stat.short.hp",
  HPDelta: "stat.short.hp",
  HPAddedRatio: "stat.short.hpPercent",
  Attack: "stat.short.atk",
  AttackDelta: "stat.short.atk",
  AttackAddedRatio: "stat.short.atkPercent",
  Defence: "stat.short.def",
  DefenceDelta: "stat.short.def",
  DefenceAddedRatio: "stat.short.defPercent",
  Speed: "stat.short.spd",
  SpeedDelta: "stat.short.spd",
  CriticalChance: "stat.short.critRate",
  CriticalChanceBase: "stat.short.critRate",
  CriticalDamage: "stat.short.critDamage",
  CriticalDamageBase: "stat.short.critDamage",
  BreakDamageAddedRatio: "stat.short.breakEffect",
  BreakDamageAddedRatioBase: "stat.short.breakEffect",
  HealRatio: "stat.short.healing",
  HealRatioBase: "stat.short.healing",
  SPRatio: "stat.short.energyRegen",
  SPRatioBase: "stat.short.energyRegen",
  StatusProbability: "stat.short.effectHit",
  StatusProbabilityBase: "stat.short.effectHit",
  StatusResistance: "stat.short.effectRes",
  StatusResistanceBase: "stat.short.effectRes",
  PhysicalAddedRatio: "stat.short.physicalDamage",
  FireAddedRatio: "stat.short.fireDamage",
  IceAddedRatio: "stat.short.iceDamage",
  ThunderAddedRatio: "stat.short.lightningDamage",
  WindAddedRatio: "stat.short.windDamage",
  QuantumAddedRatio: "stat.short.quantumDamage",
  ImaginaryAddedRatio: "stat.short.imaginaryDamage",
};

/** The compact label key for a catalog property, or null to use its full name. */
export function shortStatKey(propertyId: string): MessageKey | null {
  return SHORT_STAT_KEYS[propertyId] ?? null;
}

export type BonusTier = 4 | 2;

/**
 * The highest set bonus a piece count activates. Cavern sets grant 2- and
 * 4-piece bonuses (three pieces still give only the 2-piece bonus); Planar
 * Ornament sets grant only a 2-piece bonus.
 */
export function activeBonusTier(
  kind: RelicKind,
  pieceCount: number
): BonusTier | null {
  if (kind === "cavern" && pieceCount >= 4) return 4;
  if (pieceCount >= 2) return 2;
  return null;
}

export interface EquippedSetBonus {
  setId: string;
  tier: BonusTier;
  /** Equipped pieces of this set, which may exceed the active tier (3 → 2). */
  pieces: number;
}

export interface EquippedSetSummary {
  /** One 4-piece entry, up to two 2-piece entries, or none. */
  cavern: EquippedSetBonus[];
  planar: EquippedSetBonus | null;
}

function activeSets(
  relics: readonly Pick<Relic, "slot" | "setId">[],
  kind: RelicKind
): EquippedSetBonus[] {
  const counts = new Map<string, number>();
  for (const relic of relics) {
    if (relicCategory(relic.slot) !== kind) continue;
    counts.set(relic.setId, (counts.get(relic.setId) ?? 0) + 1);
  }
  const active: EquippedSetBonus[] = [];
  for (const [setId, pieces] of counts) {
    const tier = activeBonusTier(kind, pieces);
    if (tier !== null) active.push({ setId, tier, pieces });
  }
  return active.sort(
    (left, right) =>
      right.pieces - left.pieces || left.setId.localeCompare(right.setId)
  );
}

/** The set bonuses a Character's equipped Relics activate, grouped 4 + 2. */
export function equippedSetSummary(
  relics: readonly Pick<Relic, "slot" | "setId">[]
): EquippedSetSummary {
  return {
    cavern: activeSets(relics, "cavern"),
    planar: activeSets(relics, "planar")[0] ?? null,
  };
}
