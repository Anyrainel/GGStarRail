import { loadAchievementLogic } from "@/data/achievementLoader";
import manifestJson from "@/data/game/manifest.json";
import { loadGameMember } from "@/data/gameDataLoader";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import type { ReferenceLocale } from "@/domain/provenance";
import { RuntimeReferenceManifestSchema } from "@/domain/provenance";
import { loadCatalogAssetLookup } from "./assets";
import type {
  CharacterDefinition,
  DefinitionCatalog,
  LightConeDefinition,
  LocalizedText,
  MemberDocument,
  ProgressionTables,
  PropertyCatalog,
  PropertyTables,
  RelicPieceDefinition,
  RelicSetDefinition,
} from "./types";

export const HSR_REFERENCE_MANIFEST = RuntimeReferenceManifestSchema.parse(
  manifestJson.reference_manifest
);
export const HSR_REFERENCE_REVISION = manifestJson.source_revision;

async function loadMember<T>(collection: string): Promise<T> {
  const [document] = await Promise.all([
    loadGameMember(collection) as Promise<MemberDocument<T, "2.0.0">>,
    loadCatalogAssetLookup(),
  ]);
  if (
    document.schema_version !== HSR_REFERENCE_MANIFEST.schema_version ||
    document.collection !== collection
  ) {
    throw new Error(`Invalid ${collection} catalog schema`);
  }
  return document.value;
}

async function loadDefinitions<T extends { id: string | number }>(
  collection: string
): Promise<DefinitionCatalog<T, "2.0.0">> {
  const values = await loadMember<readonly T[]>(collection);
  return {
    schemaVersion: "2.0.0",
    values,
    byId: new Map(values.map((entry) => [entry.id, entry])),
  };
}

export function getLocalizedValue(
  text: LocalizedText,
  locale: ReferenceLocale
): string;
export function getLocalizedValue(
  text: LocalizedText | null | undefined,
  locale: ReferenceLocale
): string | null;
export function getLocalizedValue(
  text: LocalizedText | null | undefined,
  locale: ReferenceLocale
): string | null {
  return text?.[locale].value ?? null;
}

export async function loadAchievementIds(): Promise<ReadonlySet<number>> {
  return new Set(
    (await loadAchievementLogic()).categories.flatMap((category) =>
      category.achievements.flatMap((group) => group.map((entry) => entry.id))
    )
  );
}
export async function loadCharacters() {
  const catalog = await loadDefinitions<CharacterDefinition>("characters");
  // Canonical identities enumerate each playable kit once. Provider variants
  // retain exact game IDs and Trace metadata for imports and existing builds.
  return {
    ...catalog,
    identities: catalog.values.filter(
      (entry) => canonicalCharacterId(entry.id) === entry.id
    ),
  };
}
export function loadLightCones() {
  return loadDefinitions<LightConeDefinition>("light_cones");
}
export function loadRelicSets() {
  return loadDefinitions<RelicSetDefinition>("relic_sets");
}
export function loadRelicPieces() {
  return loadDefinitions<RelicPieceDefinition>("relic_pieces");
}
export async function loadPropertyTables(): Promise<PropertyCatalog> {
  const {
    properties,
    paths,
    combat_types: combatTypes,
    relic_slots: relicSlots,
  } = await loadMember<PropertyTables>("property_tables");
  return {
    schemaVersion: "2.0.0",
    properties,
    paths,
    combatTypes,
    relicSlots,
    propertyById: new Map(properties.map((entry) => [entry.id, entry])),
    pathById: new Map(paths.map((entry) => [entry.id, entry])),
    combatTypeById: new Map(combatTypes.map((entry) => [entry.id, entry])),
    relicSlotById: new Map(relicSlots.map((entry) => [entry.id, entry])),
  };
}
export function loadProgression(): Promise<ProgressionTables> {
  return loadMember<ProgressionTables>("progression");
}
