import type {
  BundleSchemaVersion,
  DataBundleManifest,
  ReferenceLocale,
} from "@/domain/provenance";

export type { BundleSchemaVersion, DataBundleManifest, ReferenceLocale };

export interface TextProvenance {
  locale: ReferenceLocale;
  source_id: string;
  source_locale: "EN" | "CHS";
  source_revision: string;
  source_path: string;
  source_key: string;
  source_reference: string;
}

export interface SourceText {
  value: string;
  provenance: TextProvenance;
}

export interface LocalizedText {
  en: SourceText;
  "zh-CN": SourceText;
}

export type AchievementRarity = "Low" | "Mid" | "High";

export type AchievementVisibility =
  | "visible"
  | "show_after_finish"
  | "hidden_description";

export interface AchievementCategoryDefinition {
  id: number;
  name: LocalizedText;
  order: number;
  icon_path: string;
  main_icon_path: string;
  gold_icon_path: string;
  silver_icon_path: string;
  copper_icon_path: string;
}

export interface AchievementCompletionConditionDefinition {
  id: number;
  finish_type: string;
  parameter_type: string;
  parameter_string: string;
  parameter_integer_1: number | null;
  parameter_integer_2: number | null;
  parameter_integer_3: number | null;
  parameter_integers: readonly number[];
  progress: number;
  is_backtrack: boolean;
  maze_floor_id: number | null;
  maze_plane_id: number | null;
}

export interface AchievementRewardDefinition {
  reward_id: number;
  item_id: 1;
  count: 5 | 10 | 20;
}

export interface AchievementDefinition {
  id: number;
  category_id: number;
  quest_id: number;
  linear_quest_id: number;
  name: LocalizedText;
  description: LocalizedText;
  hidden_description: LocalizedText | null;
  description_parameters: readonly number[];
  order: number;
  rarity: AchievementRarity;
  visibility: AchievementVisibility;
  icon_path: string;
  reward: AchievementRewardDefinition;
  chain_ids: readonly number[];
  chain_index: number;
  previous_id: number | null;
  next_ids: readonly number[];
  completion_condition: AchievementCompletionConditionDefinition;
  ps_trophy_id: string | null;
  ps_name: LocalizedText | null;
  ps_description: LocalizedText | null;
  record_type: string | null;
  record_text: LocalizedText | null;
  release_version: string | null;
}

export interface MemberDocument<
  T,
  TSchemaVersion extends BundleSchemaVersion = BundleSchemaVersion,
> {
  bundle_id: "ggstarrail-reference";
  collection: string;
  game_id: "honkai_star_rail";
  schema_version: TSchemaVersion;
  source_revision: string;
  value: T;
}

export interface CorroborationDocument<
  T,
  TSchemaVersion extends BundleSchemaVersion = BundleSchemaVersion,
> {
  bundle_id: "ggstarrail-reference";
  game_id: "honkai_star_rail";
  role: "validation_only_never_normalized_override";
  schema_version: TSchemaVersion;
  source_revision: string;
  value: T;
}

export interface CostItem {
  item_id: string;
  count: number;
}

export interface LinearStat {
  base_value: number;
  level_add: number;
}

export interface CharacterStats {
  hp: LinearStat;
  attack: LinearStat;
  defence: LinearStat;
  speed: LinearStat;
  critical_chance: LinearStat;
  critical_damage: LinearStat;
  base_aggro: LinearStat;
}

export interface LightConeStats {
  hp: LinearStat;
  attack: LinearStat;
  defence: LinearStat;
}

export interface CharacterPromotion {
  promotion: number;
  max_level: number;
  player_level_required: number | null;
  world_level_required: number | null;
  costs: readonly CostItem[];
  stats: CharacterStats;
}

export interface LightConePromotion {
  promotion: number;
  max_level: number;
  player_level_required: number | null;
  world_level_required: number | null;
  costs: readonly CostItem[];
  stats: LightConeStats;
}

export interface EffectLevel {
  level: number;
  parameters: readonly number[];
}

export interface PropertyValue {
  property_id: string;
  value: number;
}

export interface CharacterSkillLevelV1_1 extends EffectLevel {
  simple_parameters: readonly number[];
  display_parameters: readonly number[];
  level_up_costs: readonly CostItem[];
}

interface CharacterSkillCommon {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  simple_description: LocalizedText | null;
  trigger_key: string;
  attack_type: string;
  effect_type: string;
  max_level: number;
  levels: readonly EffectLevel[];
}

export type CharacterSkillV1 = CharacterSkillCommon;

export interface CharacterSkillV1_1 extends CharacterSkillCommon {
  source_table: "AvatarSkillConfig" | "AvatarServantSkillConfig";
  tag: LocalizedText | null;
  type_description: LocalizedText | null;
  display_description: LocalizedText;
  display_description_source: "simple_description" | "description";
  hide_in_ui: boolean;
  icon_path: string;
  ultimate_icon_path: string | null;
  rated_trace_ids: readonly string[];
  rated_rank_ids: readonly string[];
  extra_effect_ids: readonly string[];
  simple_extra_effect_ids: readonly string[];
  levels: readonly CharacterSkillLevelV1_1[];
}

export type CharacterSkill = CharacterSkillV1 | CharacterSkillV1_1;

export interface CharacterRank {
  id: string;
  rank: number;
  name: LocalizedText;
  description: LocalizedText;
  icon_path: string;
  unlock_costs: readonly CostItem[];
  parameters: readonly number[];
  skill_level_additions: Readonly<Record<string, number>>;
  extra_effect_ids: readonly string[];
  ability_names: readonly string[];
}

export interface CharacterTraceLevel {
  level: number;
  promotion_required: number | null;
  character_level_required: number | null;
  costs: readonly CostItem[];
  parameters: readonly number[];
  properties: readonly PropertyValue[];
}

export interface CharacterTrace {
  id: string;
  point_type: number;
  anchor_type: string;
  max_level: number;
  default_unlock: boolean;
  prerequisite_ids: readonly string[];
  name: LocalizedText | null;
  description: LocalizedText | null;
  icon_path: string;
  trigger_key: string;
  skill_ids: readonly string[];
  extra_effect_ids: readonly string[];
  simple_extra_effect_ids: readonly string[];
  ability_name: string | null;
  levels: readonly CharacterTraceLevel[];
}

export interface CharacterSkillEnhancement {
  skill_id: string;
  trace_id: string;
  simple_description_before: LocalizedText;
  simple_description_after: LocalizedText;
  description_before: LocalizedText;
  description_after: LocalizedText;
}

export interface CharacterTraceEnhancement {
  trace_id: string;
  description_before: LocalizedText;
  description_after: LocalizedText;
}

export interface CharacterRankEnhancement {
  rank_id: string;
  description_before: LocalizedText;
  description_after: LocalizedText;
}

export interface CharacterServant {
  id: string;
  name: LocalizedText;
  icon_path: string;
  skills: readonly CharacterSkillV1_1[];
}

export interface CharacterEnhancementVariant {
  enhanced_id: number;
  season_id: number;
  activity_id: number;
  max_energy: number;
  summaries: readonly LocalizedText[];
  skills: readonly CharacterSkillV1_1[];
  ranks: readonly CharacterRank[];
  traces: readonly CharacterTrace[];
  skill_changes: readonly CharacterSkillEnhancement[];
  trace_changes: readonly CharacterTraceEnhancement[];
  rank_changes: readonly CharacterRankEnhancement[];
}

interface CharacterDefinitionCommon {
  id: string;
  rarity: number;
  path_id: string;
  combat_type_id: string;
  name: LocalizedText;
  description: LocalizedText | null;
  max_promotion: number;
  max_rank: number;
  max_energy: number;
  experience_type: number;
  icon_path: string;
  promotions: readonly CharacterPromotion[];
  skills: readonly CharacterSkillV1[];
}

export type CharacterDefinitionV1 = CharacterDefinitionCommon;

export interface CharacterDefinitionV1_1 extends CharacterDefinitionCommon {
  skills: readonly CharacterSkillV1_1[];
  servants: readonly CharacterServant[];
  ranks: readonly CharacterRank[];
  traces: readonly CharacterTrace[];
  enhancements: readonly CharacterEnhancementVariant[];
}

export type CharacterDefinition =
  | CharacterDefinitionV1
  | CharacterDefinitionV1_1;

export interface LightConeSuperimposition extends EffectLevel {
  name: LocalizedText;
  description: LocalizedText;
  ability_name: string;
  properties: readonly PropertyValue[];
}

export interface LightConeEffectV1 {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  superimpositions: readonly EffectLevel[];
}

export interface LightConeEffectV1_1 extends LightConeEffectV1 {
  superimpositions: readonly LightConeSuperimposition[];
}

export type LightConeEffect = LightConeEffectV1 | LightConeEffectV1_1;

interface LightConeDefinitionCommon {
  id: string;
  rarity: number;
  path_id: string;
  name: LocalizedText;
  description: LocalizedText;
  background_description: LocalizedText;
  max_promotion: number;
  max_superimposition: number;
  experience_type: number;
  icon_path: string;
  promotions: readonly LightConePromotion[];
  effect: LightConeEffectV1;
}

export type LightConeDefinitionV1 = LightConeDefinitionCommon;

export interface LightConeDefinitionV1_1 extends LightConeDefinitionCommon {
  rank_up_material_ids: readonly string[];
  effect: LightConeEffectV1_1;
}

export type LightConeDefinition =
  | LightConeDefinitionV1
  | LightConeDefinitionV1_1;

export interface ProgressionItem {
  id: string;
  source_table: "ItemConfig" | "ItemConfigAvatarRank";
  main_type: string;
  sub_type: string;
  rarity: string;
  purpose_type: number | null;
  name: LocalizedText;
  description: LocalizedText;
  background_description: LocalizedText | null;
  icon_path: string;
  character_experience: number | null;
  light_cone_experience: number | null;
  light_cone_feed_credit_cost: number | null;
}

export interface RelicSetBonus {
  required_pieces: number;
  description: LocalizedText;
  properties: readonly PropertyValue[];
  parameters: readonly number[];
}

export interface RelicSetDefinition {
  id: string;
  kind: "cavern_relic" | "planar_ornament";
  name: LocalizedText;
  release_version: string;
  icon_path: string;
  bonuses: readonly RelicSetBonus[];
}

export type RelicSlotId = "HEAD" | "HAND" | "BODY" | "FOOT" | "NECK" | "OBJECT";

export interface RelicPieceDefinition {
  id: string;
  set_id: string;
  set_kind: "cavern_relic" | "planar_ornament";
  slot: RelicSlotId;
  rarity: number;
  name: LocalizedText;
  description: LocalizedText;
  main_affix_group: number;
  sub_affix_group: number;
  max_level: number;
  experience_type: number;
  icon_path: string;
}

interface PropertyDefinitionCommon {
  id: string;
  name: LocalizedText | null;
  relic_name: LocalizedText | null;
  value_kind: "flat" | "ratio" | "unknown";
  display_order: number;
  is_displayed: boolean;
  is_battle_displayed: boolean;
  icon_path: string;
}

export type PropertyDefinitionV1 = PropertyDefinitionCommon;

export interface PropertyDefinitionV1_1 extends PropertyDefinitionCommon {
  usable_icon_path: string | null;
}

export type PropertyDefinition = PropertyDefinitionV1 | PropertyDefinitionV1_1;

export interface PathDefinition {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  icon_path: string;
}

export interface CombatTypeDefinition {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  color: string;
  icon_path: string;
}

export interface RelicSlotDefinition {
  id: RelicSlotId;
  name: LocalizedText;
  icon_path: string;
  valid_main_properties: readonly string[];
}

interface PropertyTablesCommon<TProperty extends PropertyDefinition> {
  properties: readonly TProperty[];
  paths: readonly PathDefinition[];
  combat_types: readonly CombatTypeDefinition[];
  relic_slots: readonly RelicSlotDefinition[];
}

export type PropertyTablesV1 = PropertyTablesCommon<PropertyDefinitionV1>;
export type PropertyTablesV1_1 = PropertyTablesCommon<PropertyDefinitionV1_1>;
export type PropertyTables = PropertyTablesV1 | PropertyTablesV1_1;

export interface ExperienceLevel {
  level: number;
  experience: number;
}

export interface ExperienceTable {
  id: number;
  levels: readonly ExperienceLevel[];
}

export interface MainAffixDefinition {
  group_id: number;
  affix_id: number;
  property_id: string;
  base_value: number;
  level_add: number;
  max_level: number;
  level_values: readonly number[];
}

export interface SubAffixDefinition {
  group_id: number;
  affix_id: number;
  property_id: string;
  base_value: number;
  step_value: number;
  step_count: number;
  roll_values: readonly number[];
}

export interface RelicAffixScoreBase {
  property_id: string;
  score_type: string;
  base_value: number;
  value_per_level: number | null;
}

export interface CharacterRelicScoreWeights {
  character_id: string;
  character_exported: boolean;
  weights: Readonly<Record<string, number>>;
}

export interface RelicScoringTables {
  main_affix_base_values: readonly RelicAffixScoreBase[];
  sub_affix_base_values: readonly RelicAffixScoreBase[];
  main_affix_character_weights: readonly CharacterRelicScoreWeights[];
  sub_affix_character_weights: readonly CharacterRelicScoreWeights[];
}

interface ProgressionTablesCommon {
  character_experience: readonly ExperienceTable[];
  light_cone_experience: readonly ExperienceTable[];
  relic_experience: readonly ExperienceTable[];
  relic_main_affixes: readonly MainAffixDefinition[];
  relic_sub_affixes: readonly SubAffixDefinition[];
  relic_scoring: RelicScoringTables;
}

export type ProgressionTablesV1 = ProgressionTablesCommon;

export interface ProgressionTablesV1_1 extends ProgressionTablesCommon {
  items: readonly ProgressionItem[];
}

export type ProgressionTables = ProgressionTablesV1 | ProgressionTablesV1_1;

export interface SourceDisagreement {
  evidence_id: string;
  source_id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  locale: ReferenceLocale | null;
  expected: string | number | boolean | null;
  datamine_value: string | number | boolean | null;
  severity: "error" | "warning" | "info";
}

export interface UnresolvedMapping {
  table: string;
  logical_field: string;
  candidates: readonly string[];
  reason: string;
}

export interface SourceGap {
  table: string;
  record_id: string;
  field: string;
  reason: string;
}

export interface Diagnostics {
  resolved_deobfuscation: Readonly<Record<string, string>>;
  unresolved_deobfuscation: readonly UnresolvedMapping[];
  source_disagreements: readonly SourceDisagreement[];
  source_gaps: readonly SourceGap[];
}

export interface CorroborationEvidence {
  schema_version: number;
  snapshot_date: string;
  sources: readonly Readonly<Record<string, unknown>>[];
  checks: readonly Readonly<Record<string, unknown>>[];
  known_presence_disagreements: readonly Readonly<Record<string, unknown>>[];
}

export interface DefinitionCatalog<
  T extends { id: string | number },
  TSchemaVersion extends BundleSchemaVersion = BundleSchemaVersion,
> {
  schemaVersion: TSchemaVersion;
  values: readonly T[];
  byId: ReadonlyMap<T["id"], T>;
}

export type AchievementCategoryCatalog = DefinitionCatalog<
  AchievementCategoryDefinition,
  "1.2.0"
>;

export type AchievementCatalog = DefinitionCatalog<
  AchievementDefinition,
  "1.2.0"
>;

export type CharacterCatalog =
  | DefinitionCatalog<CharacterDefinitionV1, "1.0.0">
  | DefinitionCatalog<CharacterDefinitionV1_1, "1.1.0">
  | DefinitionCatalog<CharacterDefinitionV1_1, "1.2.0">;

export type LightConeCatalog =
  | DefinitionCatalog<LightConeDefinitionV1, "1.0.0">
  | DefinitionCatalog<LightConeDefinitionV1_1, "1.1.0">
  | DefinitionCatalog<LightConeDefinitionV1_1, "1.2.0">;

interface PropertyCatalogCommon<
  TProperty extends PropertyDefinition,
  TSchemaVersion extends BundleSchemaVersion,
> {
  schemaVersion: TSchemaVersion;
  properties: readonly TProperty[];
  paths: readonly PathDefinition[];
  combatTypes: readonly CombatTypeDefinition[];
  relicSlots: readonly RelicSlotDefinition[];
  propertyById: ReadonlyMap<string, TProperty>;
  pathById: ReadonlyMap<string, PathDefinition>;
  combatTypeById: ReadonlyMap<string, CombatTypeDefinition>;
  relicSlotById: ReadonlyMap<string, RelicSlotDefinition>;
}

export type PropertyCatalogV1 = PropertyCatalogCommon<
  PropertyDefinitionV1,
  "1.0.0"
>;

export type PropertyCatalogV1_1 = PropertyCatalogCommon<
  PropertyDefinitionV1_1,
  "1.1.0" | "1.2.0"
>;

export type PropertyCatalog = PropertyCatalogV1 | PropertyCatalogV1_1;

export interface HsrReferenceCatalog {
  manifest: DataBundleManifest;
  characters: readonly CharacterDefinition[];
  lightCones: readonly LightConeDefinition[];
  relicSets: readonly RelicSetDefinition[];
  relicPieces: readonly RelicPieceDefinition[];
  properties: readonly PropertyDefinition[];
}
