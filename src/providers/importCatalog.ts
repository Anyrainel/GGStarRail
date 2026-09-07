import type { RuntimeReferenceManifest } from "@/domain/provenance";
import {
  HSR_REFERENCE_MANIFEST,
  loadCharacters,
  loadLightCones,
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
} from "@/providers/gilore/catalog";
import type {
  CharacterDefinition,
  LightConeDefinition,
  ProgressionTables,
  PropertyDefinition,
  RelicPieceDefinition,
} from "@/providers/gilore/types";

export interface AccountImportCatalog {
  manifest: RuntimeReferenceManifest;
  characters: ReadonlyMap<string, CharacterDefinition>;
  lightCones: ReadonlyMap<string, LightConeDefinition>;
  relicPieces: ReadonlyMap<string, RelicPieceDefinition>;
  properties: ReadonlyMap<string, PropertyDefinition>;
  progression: ProgressionTables;
}

export async function loadAccountImportCatalog(): Promise<AccountImportCatalog> {
  const [characters, lightCones, relicPieces, properties, progression] =
    await Promise.all([
      loadCharacters(),
      loadLightCones(),
      loadRelicPieces(),
      loadPropertyTables(),
      loadProgression(),
    ]);

  return {
    manifest: HSR_REFERENCE_MANIFEST,
    characters: characters.byId,
    lightCones: lightCones.byId,
    relicPieces: relicPieces.byId,
    properties: properties.propertyById,
    progression,
  };
}
