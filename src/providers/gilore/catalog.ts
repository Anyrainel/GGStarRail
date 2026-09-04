import manifestJson from "@/generated/hsr-reference/manifest.json";
import { loadCatalogAssetLookup } from "./assets";
import { parseGIloreManifest } from "./manifest";
import type {
  AchievementCatalog,
  AchievementCategoryCatalog,
  AchievementCategoryDefinition,
  AchievementDefinition,
  BundleSchemaVersion,
  CharacterCatalog,
  CharacterDefinition,
  CharacterDefinitionV1,
  CharacterDefinitionV1_1,
  CharacterSkill,
  CharacterSkillV1_1,
  CombatTypeDefinition,
  CorroborationDocument,
  CorroborationEvidence,
  DefinitionCatalog,
  Diagnostics,
  LightConeCatalog,
  LightConeDefinition,
  LightConeDefinitionV1,
  LightConeDefinitionV1_1,
  LocalizedText,
  MemberDocument,
  PathDefinition,
  ProgressionTables,
  ProgressionTablesV1,
  ProgressionTablesV1_1,
  PropertyCatalog,
  PropertyCatalogV1,
  PropertyCatalogV1_1,
  PropertyDefinition,
  PropertyDefinitionV1,
  PropertyDefinitionV1_1,
  PropertyTablesV1,
  PropertyTablesV1_1,
  ReferenceLocale,
  RelicPieceDefinition,
  RelicSetDefinition,
  RelicSlotDefinition,
} from "./types";

export const HSR_REFERENCE_MANIFEST = parseGIloreManifest(manifestJson);

function createDefinitionCatalog<
  T extends { id: string | number },
  TSchemaVersion extends BundleSchemaVersion,
>(
  values: readonly T[],
  schemaVersion: TSchemaVersion
): DefinitionCatalog<T, TSchemaVersion> {
  const byId = new Map<T["id"], T>();
  for (const entry of values) byId.set(entry.id, entry);
  return {
    schemaVersion,
    values,
    byId,
  };
}

function assertMemberSchema(
  document: { schema_version: unknown },
  collection: string
): void {
  if (document.schema_version !== HSR_REFERENCE_MANIFEST.schema_version) {
    throw new Error(
      `${collection} schema ${String(document.schema_version)} does not match manifest schema ${HSR_REFERENCE_MANIFEST.schema_version}`
    );
  }
}

export function isCharacterDefinitionV1_1(
  character: CharacterDefinition
): character is CharacterDefinitionV1_1 {
  return "servants" in character;
}

export function isCharacterSkillV1_1(
  skill: CharacterSkill
): skill is CharacterSkillV1_1 {
  return "source_table" in skill;
}

export function isLightConeDefinitionV1_1(
  lightCone: LightConeDefinition
): lightCone is LightConeDefinitionV1_1 {
  return "rank_up_material_ids" in lightCone;
}

export function isProgressionTablesV1_1(
  progression: ProgressionTables
): progression is ProgressionTablesV1_1 {
  return "items" in progression;
}

export function isPropertyDefinitionV1_1(
  property: PropertyDefinition
): property is PropertyDefinitionV1_1 {
  return "usable_icon_path" in property;
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

export async function loadAchievementCategories(): Promise<AchievementCategoryCatalog> {
  const [module] = await Promise.all([
    import("@/generated/hsr-reference/achievement_categories.json"),
    loadCatalogAssetLookup(),
  ]);
  const document = module.default as unknown as MemberDocument<
    readonly AchievementCategoryDefinition[],
    "1.2.0"
  >;
  assertMemberSchema(document, "achievement_categories");
  return createDefinitionCatalog(document.value, document.schema_version);
}

export async function loadAchievements(): Promise<AchievementCatalog> {
  const [module] = await Promise.all([
    import("@/generated/hsr-reference/achievements.json"),
    loadCatalogAssetLookup(),
  ]);
  const document = module.default as unknown as MemberDocument<
    readonly AchievementDefinition[],
    "1.2.0"
  >;
  assertMemberSchema(document, "achievements");
  return createDefinitionCatalog(document.value, document.schema_version);
}

let achievementIdsPromise: Promise<ReadonlySet<number>> | null = null;

export function loadAchievementIds(): Promise<ReadonlySet<number>> {
  achievementIdsPromise ??= loadAchievements().then(
    (catalog) => new Set(catalog.byId.keys())
  );
  return achievementIdsPromise;
}

export async function loadCharacters(): Promise<CharacterCatalog> {
  const [module] = await Promise.all([
    import("@/generated/hsr-reference/characters.json"),
    loadCatalogAssetLookup(),
  ]);
  const document = module.default as unknown as
    | MemberDocument<readonly CharacterDefinitionV1[], "1.0.0">
    | MemberDocument<readonly CharacterDefinitionV1_1[], "1.1.0">
    | MemberDocument<readonly CharacterDefinitionV1_1[], "1.2.0">;
  assertMemberSchema(document, "characters");
  return document.schema_version === "1.0.0"
    ? createDefinitionCatalog(document.value, document.schema_version)
    : createDefinitionCatalog(document.value, document.schema_version);
}

export async function loadLightCones(): Promise<LightConeCatalog> {
  const [module] = await Promise.all([
    import("@/generated/hsr-reference/light_cones.json"),
    loadCatalogAssetLookup(),
  ]);
  const document = module.default as unknown as
    | MemberDocument<readonly LightConeDefinitionV1[], "1.0.0">
    | MemberDocument<readonly LightConeDefinitionV1_1[], "1.1.0">
    | MemberDocument<readonly LightConeDefinitionV1_1[], "1.2.0">;
  assertMemberSchema(document, "light_cones");
  return document.schema_version === "1.0.0"
    ? createDefinitionCatalog(document.value, document.schema_version)
    : createDefinitionCatalog(document.value, document.schema_version);
}

export async function loadRelicSets(): Promise<
  DefinitionCatalog<RelicSetDefinition>
> {
  const [module] = await Promise.all([
    import("@/generated/hsr-reference/relic_sets.json"),
    loadCatalogAssetLookup(),
  ]);
  const document = module.default as unknown as MemberDocument<
    readonly RelicSetDefinition[]
  >;
  assertMemberSchema(document, "relic_sets");
  return createDefinitionCatalog(document.value, document.schema_version);
}

export async function loadRelicPieces(): Promise<
  DefinitionCatalog<RelicPieceDefinition>
> {
  const [module] = await Promise.all([
    import("@/generated/hsr-reference/relic_pieces.json"),
    loadCatalogAssetLookup(),
  ]);
  const document = module.default as unknown as MemberDocument<
    readonly RelicPieceDefinition[]
  >;
  assertMemberSchema(document, "relic_pieces");
  return createDefinitionCatalog(document.value, document.schema_version);
}

export async function loadPropertyTables(): Promise<PropertyCatalog> {
  const [module] = await Promise.all([
    import("@/generated/hsr-reference/property_tables.json"),
    loadCatalogAssetLookup(),
  ]);
  const document = module.default as unknown as
    | MemberDocument<PropertyTablesV1, "1.0.0">
    | MemberDocument<PropertyTablesV1_1, "1.1.0">
    | MemberDocument<PropertyTablesV1_1, "1.2.0">;
  assertMemberSchema(document, "property_tables");
  if (document.schema_version === "1.0.0") {
    const {
      properties,
      paths,
      combat_types: combatTypes,
      relic_slots: relicSlots,
    } = document.value;
    const catalog: PropertyCatalogV1 = {
      schemaVersion: document.schema_version,
      properties,
      paths,
      combatTypes,
      relicSlots,
      propertyById: new Map<string, PropertyDefinitionV1>(
        properties.map((entry) => [entry.id, entry])
      ),
      pathById: new Map<string, PathDefinition>(
        paths.map((entry) => [entry.id, entry])
      ),
      combatTypeById: new Map<string, CombatTypeDefinition>(
        combatTypes.map((entry) => [entry.id, entry])
      ),
      relicSlotById: new Map<string, RelicSlotDefinition>(
        relicSlots.map((entry) => [entry.id, entry])
      ),
    };
    return catalog;
  }
  const {
    properties,
    paths,
    combat_types: combatTypes,
    relic_slots: relicSlots,
  } = document.value;
  const catalog: PropertyCatalogV1_1 = {
    schemaVersion: document.schema_version,
    properties,
    paths,
    combatTypes,
    relicSlots,
    propertyById: new Map<string, PropertyDefinitionV1_1>(
      properties.map((entry) => [entry.id, entry])
    ),
    pathById: new Map<string, PathDefinition>(
      paths.map((entry) => [entry.id, entry])
    ),
    combatTypeById: new Map<string, CombatTypeDefinition>(
      combatTypes.map((entry) => [entry.id, entry])
    ),
    relicSlotById: new Map<string, RelicSlotDefinition>(
      relicSlots.map((entry) => [entry.id, entry])
    ),
  };
  return catalog;
}

export async function loadProgression(): Promise<ProgressionTables> {
  const module = await import("@/generated/hsr-reference/progression.json");
  const document = module.default as unknown as
    | MemberDocument<ProgressionTablesV1, "1.0.0">
    | MemberDocument<ProgressionTablesV1_1, "1.1.0">
    | MemberDocument<ProgressionTablesV1_1, "1.2.0">;
  assertMemberSchema(document, "progression");
  return document.value;
}

export async function loadDiagnostics(): Promise<Diagnostics> {
  const module = await import("@/generated/hsr-reference/diagnostics.json");
  const document = module.default as unknown as MemberDocument<Diagnostics>;
  assertMemberSchema(document, "diagnostics");
  return document.value;
}

export async function loadCorroboration(): Promise<CorroborationEvidence> {
  const module = await import("@/generated/hsr-reference/corroboration.json");
  const document =
    module.default as unknown as CorroborationDocument<CorroborationEvidence>;
  assertMemberSchema(document, "corroboration");
  return document.value;
}
