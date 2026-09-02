import type { RelicScoringContext } from "@/domain/build/scoring";
import {
  loadCharacters,
  loadLightCones,
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";

export async function loadBuildReferences() {
  const [
    characters,
    lightCones,
    relicPieces,
    relicSets,
    properties,
    progression,
  ] = await Promise.all([
    loadCharacters(),
    loadLightCones(),
    loadRelicPieces(),
    loadRelicSets(),
    loadPropertyTables(),
    loadProgression(),
  ]);
  return {
    characters,
    lightCones,
    relicPieces,
    relicSets,
    properties,
    progression,
  };
}

export type BuildReferences = Awaited<ReturnType<typeof loadBuildReferences>>;

export function createRelicScoringContext(
  references: BuildReferences
): RelicScoringContext {
  return {
    properties: references.properties.propertyById,
    relicPieces: references.relicPieces.byId,
    mainAffixes: references.progression.relic_main_affixes,
    subAffixes: references.progression.relic_sub_affixes,
  };
}
