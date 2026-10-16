import { getReferenceLocale } from "@/config/referenceLocale";
import type { CombatReferenceData } from "@/domain/combat/model/data";
import {
  loadCharacters,
  loadLightCones,
  loadRelicSets,
} from "@/providers/reference/catalog";

/** Catalog definitions satisfy the combat engine's structural data types. */
export async function loadCombatReferenceData(
  locale = getReferenceLocale()
): Promise<CombatReferenceData> {
  const [characters, lightCones, relicSets] = await Promise.all([
    loadCharacters(locale),
    loadLightCones(locale),
    loadRelicSets(locale),
  ]);
  return {
    characters: characters.byId,
    lightCones: lightCones.byId,
    relicSets: relicSets.byId,
  };
}
