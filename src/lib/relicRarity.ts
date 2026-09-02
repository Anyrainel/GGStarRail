import type { RelicPieceDefinition } from "@/providers/gilore/types";

/** Resolve each set's display rarity from the highest-rarity piece it contains. */
export function createRelicSetRarityMap(
  pieces: readonly Pick<RelicPieceDefinition, "set_id" | "rarity">[]
): ReadonlyMap<string, number> {
  const rarityBySet = new Map<string, number>();
  for (const piece of pieces) {
    rarityBySet.set(
      piece.set_id,
      Math.max(rarityBySet.get(piece.set_id) ?? piece.rarity, piece.rarity)
    );
  }
  return rarityBySet;
}
