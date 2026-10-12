import type { RelicSlot } from "@/domain/account/schemas";
import type { RelicTables, RollQuality } from "@/domain/combat/optimize/relics";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import type {
  ProgressionTables,
  RelicPieceDefinition,
} from "@/providers/reference/types";

const QUALITY_INDEX: Record<RollQuality, number> = {
  low: 0,
  average: 1,
  high: 2,
};

/** 5★ Relic value tables from the progression catalog. */
export function buildRelicTables(
  progression: ProgressionTables,
  pieces: readonly RelicPieceDefinition[]
): RelicTables {
  const fiveStar = pieces.filter((piece) => piece.rarity === 5);
  const mainGroupBySlot = new Map<string, number>();
  let subGroup: number | null = null;
  for (const piece of fiveStar) {
    mainGroupBySlot.set(piece.slot, piece.main_affix_group);
    subGroup = piece.sub_affix_group;
  }
  const mainBySlot = new Map<RelicSlot, Map<string, number>>();
  for (const [slot, catalogSlot] of Object.entries(CATALOG_RELIC_SLOT) as [
    RelicSlot,
    string,
  ][]) {
    const group = mainGroupBySlot.get(catalogSlot);
    const values = new Map<string, number>();
    for (const affix of progression.relic_main_affixes) {
      if (affix.group_id !== group) continue;
      const value =
        affix.level_values[affix.max_level] ?? affix.level_values.at(-1);
      if (value !== undefined) values.set(affix.property_id, value);
    }
    mainBySlot.set(slot, values);
  }
  const rolls = new Map<string, readonly number[]>();
  for (const affix of progression.relic_sub_affixes) {
    if (affix.group_id === subGroup)
      rolls.set(affix.property_id, affix.roll_values);
  }
  const substatProperties = [...rolls.keys()];
  return {
    mainStatValue: (slot, propertyId) => mainBySlot.get(slot)?.get(propertyId),
    mainStatOptions: (slot) => [...(mainBySlot.get(slot)?.keys() ?? [])],
    substatRoll: (propertyId, quality) => {
      const values = rolls.get(propertyId);
      if (!values || values.length === 0) return 0;
      return values[Math.min(values.length - 1, QUALITY_INDEX[quality])] ?? 0;
    },
    substatProperties,
  };
}
