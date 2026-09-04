import { z } from "zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const SourceFileEntrySchema = z
  .object({
    row_count: z.number().int().nonnegative(),
    sha256: Sha256Schema,
  })
  .strict();
const BundleFileEntrySchema = z
  .object({
    byte_count: z.number().int().nonnegative(),
    entity_count: z.number().int().nonnegative().nullable(),
    sha256: Sha256Schema,
  })
  .strict();

export const ReferenceLocaleSchema = z.enum(["en", "zh-CN"]);

export const BundleSchemaVersionSchema = z.enum(["1.0.0", "1.1.0", "1.2.0"]);

const CommonCountsShape = {
  cavern_relic_sets: z.number().int().nonnegative(),
  character_experience_tables: z.number().int().nonnegative(),
  characters: z.number().int().nonnegative(),
  combat_types: z.number().int().nonnegative(),
  light_cone_experience_tables: z.number().int().nonnegative(),
  light_cones: z.number().int().nonnegative(),
  logical_relic_pieces: z.number().int().nonnegative(),
  paths: z.number().int().nonnegative(),
  planar_ornament_sets: z.number().int().nonnegative(),
  properties: z.number().int().nonnegative(),
  relic_experience_tables: z.number().int().nonnegative(),
  relic_main_affix_character_weights: z.number().int().nonnegative(),
  relic_main_affix_score_bases: z.number().int().nonnegative(),
  relic_main_affixes: z.number().int().nonnegative(),
  relic_piece_variants: z.number().int().nonnegative(),
  relic_sets: z.number().int().nonnegative(),
  relic_slots: z.number().int().nonnegative(),
  relic_sub_affix_character_weights: z.number().int().nonnegative(),
  relic_sub_affix_score_bases: z.number().int().nonnegative(),
  relic_sub_affixes: z.number().int().nonnegative(),
} as const;

const ExpandedCountsShape = {
  ...CommonCountsShape,
  character_enhancement_variants: z.number().int().nonnegative(),
  character_ranks: z.number().int().nonnegative(),
  character_servant_attachments: z.number().int().nonnegative(),
  character_servant_skills: z.number().int().nonnegative(),
  character_servants: z.number().int().nonnegative(),
  character_skills: z.number().int().nonnegative(),
  character_skills_using_description_fallback: z.number().int().nonnegative(),
  character_trace_levels: z.number().int().nonnegative(),
  character_trace_nodes: z.number().int().nonnegative(),
  enhanced_character_ranks: z.number().int().nonnegative(),
  enhanced_character_skills: z.number().int().nonnegative(),
  enhanced_character_trace_levels: z.number().int().nonnegative(),
  enhanced_character_trace_nodes: z.number().int().nonnegative(),
  light_cone_superimpositions: z.number().int().nonnegative(),
  progression_items: z.number().int().nonnegative(),
  properties_with_real_icons: z.number().int().nonnegative(),
} as const;

const V1CountsSchema = z.object(CommonCountsShape).strict();
const V1_1CountsSchema = z.object(ExpandedCountsShape).strict();
const V1_2CountsSchema = z
  .object({
    ...ExpandedCountsShape,
    achievement_categories: z.number().int().nonnegative(),
    achievement_linear_quests: z.number().int().nonnegative(),
    achievements: z.number().int().nonnegative(),
    achievements_hidden_description: z.number().int().nonnegative(),
    achievements_show_after_finish: z.number().int().nonnegative(),
    achievements_with_release_version: z.number().int().nonnegative(),
  })
  .strict();

const CommonManifestFilesShape = {
  "characters.json": BundleFileEntrySchema,
  "corroboration.json": BundleFileEntrySchema,
  "diagnostics.json": BundleFileEntrySchema,
  "light_cones.json": BundleFileEntrySchema,
  "progression.json": BundleFileEntrySchema,
  "property_tables.json": BundleFileEntrySchema,
  "relic_pieces.json": BundleFileEntrySchema,
  "relic_sets.json": BundleFileEntrySchema,
} as const;

const ManifestFilesSchema = z.object(CommonManifestFilesShape).strict();
const ManifestFilesV1_2Schema = z
  .object({
    ...CommonManifestFilesShape,
    "achievement_categories.json": BundleFileEntrySchema,
    "achievements.json": BundleFileEntrySchema,
  })
  .strict();

const ManifestSourceSchema = z
  .object({
    branch: z.string().min(1),
    commit_time: z.string().datetime({ offset: true }),
    commit_title: z.string().min(1),
    license_status: z.string().min(1),
    remote_url: z.string().url(),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    source_id: z.literal("turn_based_game_data"),
    source_version: z.string().min(1),
  })
  .strict();

const CommonManifestShape = {
  bundle_id: z.literal("ggstarrail-reference"),
  game_id: z.literal("honkai_star_rail"),
  locales: z.tuple([z.literal("en"), z.literal("zh-CN")]),
  source: ManifestSourceSchema,
  source_files: z.record(z.string().min(1), SourceFileEntrySchema),
} as const;

export const DataBundleManifestSchema = z.discriminatedUnion("schema_version", [
  z
    .object({
      ...CommonManifestShape,
      counts: V1CountsSchema,
      files: ManifestFilesSchema,
      schema_version: z.literal("1.0.0"),
    })
    .strict(),
  z
    .object({
      ...CommonManifestShape,
      counts: V1_1CountsSchema,
      files: ManifestFilesSchema,
      schema_version: z.literal("1.1.0"),
    })
    .strict(),
  z
    .object({
      ...CommonManifestShape,
      counts: V1_2CountsSchema,
      files: ManifestFilesV1_2Schema,
      schema_version: z.literal("1.2.0"),
    })
    .strict(),
]);

export type DataBundleManifest = z.infer<typeof DataBundleManifestSchema>;
export type BundleSchemaVersion = z.infer<typeof BundleSchemaVersionSchema>;
export type ReferenceLocale = z.infer<typeof ReferenceLocaleSchema>;
