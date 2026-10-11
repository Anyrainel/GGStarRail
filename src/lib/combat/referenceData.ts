import type { CombatReferenceData } from "@/domain/combat/model/data";
import {
  loadCharacters,
  loadLightCones,
  loadRelicSets,
} from "@/providers/reference/catalog";

/** Catalog definitions satisfy the combat engine's structural data types. */
export async function loadCombatReferenceData(): Promise<CombatReferenceData> {
  const [characters, lightCones, relicSets] = await Promise.all([
    loadCharacters(),
    loadLightCones(),
    loadRelicSets(),
  ]);
  return {
    characters: characters.byId,
    lightCones: lightCones.byId,
    relicSets: relicSets.byId,
  };
}
