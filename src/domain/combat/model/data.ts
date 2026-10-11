/**
 * The slice of reference-catalog definitions the combat engine reads. These
 * are structural so the domain never imports provider modules; catalog
 * objects satisfy them directly.
 */

export interface KitText {
  en: { value: string };
}

export interface KitLinearStat {
  base_value: number;
  level_add: number;
}

export interface KitStats {
  hp: KitLinearStat;
  attack: KitLinearStat;
  defence: KitLinearStat;
  speed?: KitLinearStat;
  critical_chance?: KitLinearStat;
  critical_damage?: KitLinearStat;
  base_aggro?: KitLinearStat;
}

export type KitStatName = keyof KitStats;

export interface KitStatScaling {
  ascension: number;
  max_level: number;
  stats: KitStats;
}

export interface KitPropertyValue {
  property_id: string;
  value: number;
}

export interface KitSkillLevel {
  level: number;
  parameters: readonly number[];
}

export interface KitSkill {
  id: string;
  levels: readonly KitSkillLevel[];
}

export interface KitRank {
  rank: number;
  description: KitText;
  parameters: readonly number[];
}

export interface KitTrace {
  id: string;
  point_type: number;
  max_level: number;
  skill_ids: readonly string[];
  levels: readonly { level: number; parameters: readonly number[] }[];
}

export interface KitServant {
  id: string;
  skills: readonly KitSkill[];
}

export interface CharacterData {
  id: string;
  rarity: number;
  path_id: string;
  combat_type_id: string;
  max_energy: number;
  stat_scaling: readonly KitStatScaling[];
  skills: readonly KitSkill[];
  servants: readonly KitServant[];
  ranks: readonly KitRank[];
  traces: readonly KitTrace[];
  trace_stats: readonly KitPropertyValue[];
}

export interface LightConeData {
  id: string;
  path_id: string;
  rarity: number;
  stat_scaling: readonly KitStatScaling[];
  effect: {
    superimpositions: readonly {
      level: number;
      parameters: readonly number[];
      properties: readonly KitPropertyValue[];
    }[];
  };
}

export interface RelicSetData {
  id: string;
  kind: "cavern_relic" | "planar_ornament";
  bonuses: readonly {
    required_pieces: number;
    properties: readonly KitPropertyValue[];
    parameters: readonly number[];
  }[];
}

export interface CombatReferenceData {
  characters: ReadonlyMap<string, CharacterData>;
  lightCones: ReadonlyMap<string, LightConeData>;
  relicSets: ReadonlyMap<string, RelicSetData>;
}

/** Level/ascension-scaled stat, as the game computes panel base stats. */
export function scaledStat(
  scaling: readonly KitStatScaling[],
  stat: KitStatName,
  level: number,
  ascension: number
): number {
  const row =
    scaling.find((entry) => entry.ascension === ascension) ??
    [...scaling]
      .sort((left, right) => left.ascension - right.ascension)
      .find((entry) => level <= entry.max_level) ??
    scaling.at(-1);
  const linear = row?.stats[stat];
  if (!linear) return 0;
  return linear.base_value + linear.level_add * (level - 1);
}

/** Highest ascension whose level cap admits `level` (the usual account state). */
export function ascensionForLevel(
  scaling: readonly KitStatScaling[],
  level: number
): number {
  const ordered = [...scaling].sort(
    (left, right) => left.ascension - right.ascension
  );
  return (
    ordered.find((entry) => level <= entry.max_level)?.ascension ??
    ordered.at(-1)?.ascension ??
    0
  );
}
