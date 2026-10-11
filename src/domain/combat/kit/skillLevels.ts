import {
  ABILITY_TRACE_SUFFIX,
  type AbilityTraceKind,
} from "@/domain/account/traces";
import type { CharacterData, KitSkill, KitTrace } from "../model/data";

/** Ability kinds whose level the player raises in the Trace menu. */
export type LeveledAbility = Exclude<AbilityTraceKind, "technique">;

const LEVELED_ABILITIES: readonly LeveledAbility[] = [
  "basic",
  "skill",
  "ultimate",
  "talent",
  "memospriteSkill",
  "memospriteTalent",
  "elationSkill",
];

/**
 * Eidolon 3/5 text names the boosted abilities ("Skill Lv. +2, up to a
 * maximum of Lv. 15."). Parsing it keeps every Character data-driven.
 */
const BONUS_PATTERNS: readonly [LeveledAbility, RegExp][] = [
  ["memospriteSkill", /Memosprite Skill Lv\. \+(\d+)/],
  ["memospriteTalent", /Memosprite Talent Lv\. \+(\d+)/],
  ["elationSkill", /Elation Skill Lv\. \+(\d+)/],
  ["basic", /Basic ATK Lv\. \+(\d+)/],
  ["skill", /(?:^|\n|\\n)Skill Lv\. \+(\d+)/],
  ["ultimate", /Ultimate Lv\. \+(\d+)/],
  ["talent", /(?:^|\n|\\n)Talent Lv\. \+(\d+)/],
];

export function eidolonLevelBonuses(
  data: Pick<CharacterData, "ranks">,
  eidolon: number
): Readonly<Record<LeveledAbility, number>> {
  const bonuses = Object.fromEntries(
    LEVELED_ABILITIES.map((kind) => [kind, 0])
  ) as Record<LeveledAbility, number>;
  for (const rank of data.ranks) {
    if (rank.rank > eidolon) continue;
    const text = rank.description.en.value;
    for (const [kind, pattern] of BONUS_PATTERNS) {
      const match = pattern.exec(text);
      if (match) bonuses[kind] += Number(match[1]);
    }
  }
  return bonuses;
}

function traceFor(
  data: Pick<CharacterData, "id" | "traces">,
  kind: AbilityTraceKind
): KitTrace | undefined {
  const id = `${data.id}${ABILITY_TRACE_SUFFIX[kind]}`;
  return data.traces.find((trace) => trace.id === id);
}

export interface ResolvedSkill {
  skill: KitSkill;
  kind: LeveledAbility | "technique" | null;
  level: number;
}

/**
 * Effective ability levels: the account Trace level (or the normal maximum
 * when unknown) plus Eidolon bonuses, clamped to the generated level table.
 */
export class SkillLevels {
  private readonly levelByKind = new Map<LeveledAbility, number>();
  private readonly kindBySkillId = new Map<string, AbilityTraceKind>();
  private readonly skillById = new Map<string, KitSkill>();

  constructor(
    private readonly data: CharacterData,
    eidolon: number,
    accountTraces: Readonly<Record<string, number>> = {}
  ) {
    for (const skill of data.skills) this.skillById.set(skill.id, skill);
    for (const servant of data.servants) {
      for (const skill of servant.skills) this.skillById.set(skill.id, skill);
    }
    const bonuses = eidolonLevelBonuses(data, eidolon);
    for (const kind of [...LEVELED_ABILITIES, "technique"] as const) {
      const trace = traceFor(data, kind);
      if (!trace) continue;
      for (const skillId of trace.skill_ids) {
        this.kindBySkillId.set(skillId, kind);
      }
      if (kind === "technique") continue;
      const reported = accountTraces[trace.id];
      const base =
        reported !== undefined && reported > 0 ? reported : trace.max_level;
      this.levelByKind.set(kind, base + bonuses[kind]);
    }
  }

  level(kind: LeveledAbility): number {
    return this.levelByKind.get(kind) ?? 1;
  }

  resolve(skillId: string): ResolvedSkill {
    const fullId = this.qualify(skillId);
    const skill = this.skillById.get(fullId);
    if (!skill) {
      throw new Error(`Unknown skill ${fullId} for Character ${this.data.id}`);
    }
    const kind = this.kindBySkillId.get(fullId) ?? null;
    const requested =
      kind === null || kind === "technique" ? 1 : this.level(kind);
    const level = Math.min(Math.max(requested, 1), skill.levels.length);
    return { skill, kind, level };
  }

  /**
   * 1-based parameter `#index` of a skill at its effective level. Skill IDs
   * may be given in full or as the suffix after the Character ID ("02").
   */
  param(skillId: string, index: number): number {
    const { skill, level } = this.resolve(skillId);
    const row = skill.levels[level - 1] ?? skill.levels.at(-1);
    const value = row?.parameters[index - 1];
    if (value === undefined) {
      throw new Error(
        `Skill ${skill.id} has no parameter #${index} at level ${level}`
      );
    }
    return value;
  }

  private qualify(skillId: string): string {
    if (this.skillById.has(skillId)) return skillId;
    const local = `${this.data.id}${skillId}`;
    if (this.skillById.has(local)) return local;
    const servant = `1${this.data.id}${skillId}`;
    return this.skillById.has(servant) ? servant : skillId;
  }
}
