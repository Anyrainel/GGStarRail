import { getReferenceLocale } from "@/config/referenceLocale";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import type { ReferenceLocale } from "@/domain/provenance";
import { RuntimeReferenceManifestSchema } from "@/domain/provenance";
import manifestJson from "@/generated/catalog/manifest.json";
import { loadAchievementLogic } from "@/providers/reference/achievementLoader";
import { loadGameMember } from "@/providers/reference/gameDataLoader";
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

async function loadMember<T>(
  collection: string,
  locale: ReferenceLocale
): Promise<T> {
  const [document] = await Promise.all([
    loadGameMember(collection, locale) as Promise<MemberDocument<T, "2.0.0">>,
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
  collection: string,
  locale: ReferenceLocale
): Promise<DefinitionCatalog<T, "2.0.0">> {
  const values = await loadMember<readonly T[]>(collection, locale);
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
  return text ? (text[locale]?.value ?? "") : null;
}

export async function loadAchievementIds(): Promise<ReadonlySet<number>> {
  return new Set(
    (await loadAchievementLogic()).categories.flatMap((category) =>
      category.achievements.flatMap((group) => group.map((entry) => entry.id))
    )
  );
}
export async function loadCharacters(locale = getReferenceLocale()) {
  const catalog = await loadDefinitions<CharacterDefinition>(
    "characters",
    locale
  );
  // Canonical identities enumerate each playable kit once. Provider variants
  // retain exact game IDs and Trace metadata for imports and existing builds.
  return {
    ...catalog,
    identities: catalog.values.filter(
      (entry) => canonicalCharacterId(entry.id) === entry.id
    ),
  };
}
export function loadLightCones(locale = getReferenceLocale()) {
  return loadDefinitions<LightConeDefinition>("light_cones", locale);
}
export function loadRelicSets(locale = getReferenceLocale()) {
  return loadDefinitions<RelicSetDefinition>("relic_sets", locale);
}
export function loadRelicPieces(locale = getReferenceLocale()) {
  return loadDefinitions<RelicPieceDefinition>("relic_pieces", locale);
}
export async function loadPropertyTables(
  locale = getReferenceLocale()
): Promise<PropertyCatalog> {
  const {
    properties,
    paths,
    combat_types: combatTypes,
    relic_slots: relicSlots,
  } = await loadMember<PropertyTables>("property_tables", locale);
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
export function loadProgression(
  locale = getReferenceLocale()
): Promise<ProgressionTables> {
  return loadMember<ProgressionTables>("progression", locale);
}
