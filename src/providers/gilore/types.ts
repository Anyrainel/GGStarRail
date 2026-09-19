import type {
  BundleSchemaVersion,
  RuntimeReferenceManifest,
} from "@/domain/provenance";

export interface SourceText {
  value: string;
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

export interface CharacterStatScaling {
  ascension: number;
  max_level: number;
  stats: CharacterStats;
}

export interface LightConeStatScaling {
  ascension: number;
  max_level: number;
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

export interface CharacterSkillLevel extends EffectLevel {
  simple_parameters: readonly number[];
}

export interface CharacterSkill {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  simple_description: LocalizedText | null;
  normal_max_level: number;
  max_level: number;
  tag: LocalizedText | null;
  type_description: LocalizedText | null;
  hide_in_ui: boolean;
  icon_path: string;
  ultimate_icon_path: string | null;
  levels: readonly CharacterSkillLevel[];
}

export interface CharacterRank {
  id: string;
  rank: number;
  name: LocalizedText;
  description: LocalizedText;
  icon_path: string;
  parameters: readonly number[];
}

export interface CharacterTraceLevel {
  level: number;
  parameters: readonly number[];
  properties: readonly PropertyValue[];
}

export interface CharacterTrace {
  id: string;
  point_type: number;
  max_level: number;
  default_unlock: boolean;
  prerequisite_ids: readonly string[];
  name: LocalizedText | null;
  description: LocalizedText | null;
  icon_path: string;
  skill_ids: readonly string[];
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
  skills: readonly CharacterSkill[];
}

export interface CharacterEnhancementVariant {
  enhanced_id: number;
  season_id: number;
  activity_id: number;
  max_energy: number;
  summaries: readonly LocalizedText[];
  skills: readonly CharacterSkill[];
  ranks: readonly CharacterRank[];
  traces: readonly CharacterTrace[];
  trace_stats: readonly PropertyValue[];
  skill_changes: readonly CharacterSkillEnhancement[];
  trace_changes: readonly CharacterTraceEnhancement[];
  rank_changes: readonly CharacterRankEnhancement[];
}

export interface CharacterDefinition {
  id: string;
  release_version: string | null;
  rarity: number;
  path_id: string;
  combat_type_id: string;
  name: LocalizedText;
  description: LocalizedText | null;
  max_ascension: number;
  max_rank: number;
  max_energy: number;
  icon_path: string;
  stat_scaling: readonly CharacterStatScaling[];
  skills: readonly CharacterSkill[];
  servants: readonly CharacterServant[];
  ranks: readonly CharacterRank[];
  traces: readonly CharacterTrace[];
  trace_stats: readonly PropertyValue[];
  enhancements: readonly CharacterEnhancementVariant[];
  currency_war: readonly CurrencyWarCharacter[];
}

export interface CurrencyWarSkill {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  simple_description: LocalizedText | null;
  condition_description: LocalizedText | null;
  condition_parameters: readonly number[];
  tag: LocalizedText | null;
  type_description: LocalizedText | null;
  icon_path: string;
  parameters: readonly number[];
  simple_parameters: readonly number[];
  level: number;
  max_level: number;
  levels: readonly {
    level: number;
    parameters: readonly number[];
    simple_parameters: readonly number[];
  }[];
}

export interface CurrencyWarPosition {
  position: "Front" | "Back";
  name: LocalizedText;
  icon_path: string;
  tags: readonly string[];
  tag_names: readonly LocalizedText[];
}

export interface CurrencyWarStarLevel {
  star: number;
  front_description: LocalizedText | null;
  back_description: LocalizedText | null;
  front_skills: readonly CurrencyWarSkill[];
  back_skills: readonly CurrencyWarSkill[];
  servant_skills: readonly CurrencyWarSkill[];
  properties: readonly CurrencyWarPropertyValue[];
  front_power: number | null;
  back_power: number | null;
  initial_energy: number | null;
  max_energy: number | null;
  energy_bar: number | null;
  initial_energy_bar: number | null;
  luck_chance: number | null;
  luck_damage: number | null;
  heal_base: number | null;
  shield_base: number | null;
}

export interface CurrencyWarRank {
  id: string;
  rank: number;
  name: LocalizedText;
  description: LocalizedText;
  icon_path: string;
  parameters: readonly number[];
}

export interface CurrencyWarLightConeAdaptation {
  light_cone_id: string;
  level: number;
  description: LocalizedText;
  parameters: readonly number[];
  parameter_format: string | null;
}

export interface CurrencyWarSpecialEffect {
  kind: "enhancement" | "shop";
  id: string;
  group_id: number;
  name: LocalizedText;
  description: LocalizedText;
  simple_description: LocalizedText | null;
  parameters: readonly number[];
  cost: number;
  quality: number | null;
  icon_path: string;
}

export interface CurrencyWarCharacter {
  id: string;
  character_id: string;
  rarity: number;
  preferred_position: "Front" | "Back" | "Both";
  bond_ids: readonly string[];
  season_ids: readonly number[];
  in_pool: boolean;
  in_handbook: boolean;
  charge_types: readonly string[];
  remark: LocalizedText | null;
  positions: readonly CurrencyWarPosition[];
  star_levels: readonly CurrencyWarStarLevel[];
  ranks: readonly CurrencyWarRank[];
  light_cone_adaptations: readonly CurrencyWarLightConeAdaptation[];
  special_effects: readonly CurrencyWarSpecialEffect[];
  is_expert: boolean;
}

export interface CurrencyWarEquipment {
  id: string;
  name: LocalizedText;
  description: LocalizedText | null;
  parameters: readonly number[];
  icon_path: string;
  category: string;
  category_name: LocalizedText;
  kind: "equipment" | "consumable" | "forge";
  tags: readonly LocalizedText[];
  properties: readonly CurrencyWarPropertyValue[];
  recipes: readonly (readonly string[])[];
  upgrade_ids: readonly string[];
  recommended_character_ids: readonly string[];
  season_ids: readonly number[];
  in_handbook: boolean;
  dress_rule: string | null;
  dress_rule_parameters: readonly number[];
  equip_type: string | null;
  function: string | null;
  function_parameters: readonly number[];
}

export interface CurrencyWarEnvironment {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  parameters: readonly number[];
  icon_path: string;
  season_ids: readonly number[];
  in_handbook: boolean;
  remarks: readonly LocalizedText[];
}

export interface CurrencyWarStrategy {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  parameters: readonly number[];
  icon_path: string;
  quality: string;
  category_id: number;
  chapter_limits: readonly number[];
  season_ids: readonly number[];
  in_handbook: boolean;
  remarks: readonly LocalizedText[];
}

export interface CurrencyWarBondTier {
  required_count: number;
  quality: string | null;
  description: LocalizedText | null;
  parameters: readonly number[];
  property_description: LocalizedText | null;
  property_parameters: readonly number[];
  member_properties: readonly CurrencyWarPropertyValue[];
  team_properties: readonly CurrencyWarPropertyValue[];
}

export interface CurrencyWarPropertyValue {
  property_id: string;
  value: number;
  name: LocalizedText;
  value_kind: "flat" | "ratio" | "unknown";
}

export interface CurrencyWarBondRemark {
  description: LocalizedText;
  simple_description: LocalizedText | null;
  parameters: readonly number[];
  position: string | null;
  condition_type: string | null;
  condition_parameters: readonly number[];
}

export interface CurrencyWarBond {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  simple_description: LocalizedText | null;
  parameters: readonly number[];
  icon_path: string;
  activation_type: string;
  type: string | null;
  season_ids: readonly number[];
  in_handbook: boolean;
  character_ids: readonly string[];
  tiers: readonly CurrencyWarBondTier[];
  remarks: readonly CurrencyWarBondRemark[];
  sub_bonds: readonly {
    id: string;
    name: LocalizedText;
    description: LocalizedText;
    simple_description: LocalizedText | null;
    parameters: readonly number[];
    tiers: readonly CurrencyWarBondTier[];
  }[];
}

export interface LightConeSuperimposition extends EffectLevel {
  name: LocalizedText | null;
  description: LocalizedText | null;
  properties: readonly PropertyValue[];
}

export interface LightConeEffect {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  superimpositions: readonly LightConeSuperimposition[];
}

export interface LightConeDefinition {
  id: string;
  release_version: string | null;
  rarity: number;
  path_id: string;
  name: LocalizedText;
  description: LocalizedText;
  background_description: LocalizedText;
  max_ascension: number;
  max_superimposition: number;
  icon_path: string;
  stat_scaling: readonly LightConeStatScaling[];
  effect: LightConeEffect;
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
  icon_path: string;
}

export interface PropertyDefinition {
  usable_icon_path: string | null;
  id: string;
  name: LocalizedText | null;
  relic_name: LocalizedText | null;
  value_kind: "flat" | "ratio" | "unknown";
  display_order: number;
  is_displayed: boolean;
  is_battle_displayed: boolean;
  icon_path: string;
}

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

export interface PropertyTables {
  properties: readonly PropertyDefinition[];
  paths: readonly PathDefinition[];
  combat_types: readonly CombatTypeDefinition[];
  relic_slots: readonly RelicSlotDefinition[];
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

export interface ProgressionTables {
  relic_main_affixes: readonly MainAffixDefinition[];
  relic_sub_affixes: readonly SubAffixDefinition[];
  relic_scoring: RelicScoringTables;
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
  "2.0.0"
>;
export type AchievementCatalog = DefinitionCatalog<
  AchievementDefinition,
  "2.0.0"
>;
export type CharacterCatalog = DefinitionCatalog<CharacterDefinition, "2.0.0">;
export type LightConeCatalog = DefinitionCatalog<LightConeDefinition, "2.0.0">;

export interface PropertyCatalog {
  schemaVersion: "2.0.0";
  properties: readonly PropertyDefinition[];
  paths: readonly PathDefinition[];
  combatTypes: readonly CombatTypeDefinition[];
  relicSlots: readonly RelicSlotDefinition[];
  propertyById: ReadonlyMap<string, PropertyDefinition>;
  pathById: ReadonlyMap<string, PathDefinition>;
  combatTypeById: ReadonlyMap<string, CombatTypeDefinition>;
  relicSlotById: ReadonlyMap<string, RelicSlotDefinition>;
}

export interface HsrReferenceCatalog {
  manifest: RuntimeReferenceManifest;
  characters: readonly CharacterDefinition[];
  lightCones: readonly LightConeDefinition[];
  relicSets: readonly RelicSetDefinition[];
  relicPieces: readonly RelicPieceDefinition[];
  properties: readonly PropertyDefinition[];
}
