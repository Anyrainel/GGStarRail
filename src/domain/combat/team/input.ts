import type { OptionValues } from "../kit/builder";
import type { CombatType } from "../model/stats";

/** Six-piece equipment summarized as decimal property totals and set counts. */
export interface RelicLoadout {
  /** Property ID → decimal total (0.432 = 43.2%), main and substats. */
  readonly stats: Readonly<Record<string, number>>;
  /** Relic set ID → equipped piece count. */
  readonly sets: Readonly<Record<string, number>>;
}

export const EMPTY_LOADOUT: RelicLoadout = { stats: {}, sets: {} };

export interface LightConeInput {
  readonly id: string;
  readonly level: number;
  readonly ascension?: number;
  readonly superimposition: number;
}

/**
 * Generic play-pattern overrides every Character supports. Kits define the
 * default playstyle; these only bias it.
 */
export interface PlayOverrides {
  /** Prefer Skill over Basic ATK whenever Skill Points allow. */
  readonly skill?: "kit" | "prefer" | "avoid";
}

export interface MemberInput {
  readonly characterId: string;
  readonly level: number;
  readonly ascension?: number;
  readonly eidolon: number;
  /** Account trace record keyed by catalog point IDs; {} means unknown. */
  readonly traces: Readonly<Record<string, number>>;
  readonly lightCone: LightConeInput | null;
  readonly relics: RelicLoadout;
  /** Option values per entity key: `character`, `lightCone`, `set:<id>`. */
  readonly options?: Readonly<Record<string, OptionValues>>;
  readonly play?: PlayOverrides;
}

export interface ScenarioInput {
  readonly enemyCount: number;
  readonly enemyLevel: number;
  /** Displayed max Toughness of each enemy. */
  readonly toughness: number;
  /** `team`: weak to every Combat Type in the team. */
  readonly weaknesses: "team" | readonly CombatType[];
  /** RES against non-weak Combat Types. */
  readonly resistance: number;
  /** RES against Combat Types the enemy is weak to. */
  readonly weakResistance: number;
  readonly effectResistance: number;
  readonly enemySpeed: number;
  /** Cycles simulated (Memory of Chaos: first 150 AV, then 100 AV). */
  readonly cycles: number;
  /** Energy an ally regenerates when hit by the enemy's attack. */
  readonly enemyAttackEnergy: number;
}

export const SCENARIO_PRESETS = {
  bossWithAdds: {
    enemyCount: 3,
    enemyLevel: 95,
    toughness: 160,
    weaknesses: "team",
    resistance: 0.2,
    weakResistance: 0,
    effectResistance: 0.3,
    enemySpeed: 132,
    cycles: 3,
    enemyAttackEnergy: 10,
  },
  singleBoss: {
    enemyCount: 1,
    enemyLevel: 95,
    toughness: 300,
    weaknesses: "team",
    resistance: 0.2,
    weakResistance: 0,
    effectResistance: 0.3,
    enemySpeed: 144,
    cycles: 3,
    enemyAttackEnergy: 10,
  },
  fiveTargets: {
    enemyCount: 5,
    enemyLevel: 95,
    toughness: 90,
    weaknesses: "team",
    resistance: 0.2,
    weakResistance: 0,
    effectResistance: 0.3,
    enemySpeed: 120,
    cycles: 3,
    enemyAttackEnergy: 10,
  },
} as const satisfies Record<string, ScenarioInput>;

export type ScenarioPresetId = keyof typeof SCENARIO_PRESETS;

export interface TeamInput {
  readonly members: readonly MemberInput[];
  readonly scenario: ScenarioInput;
}
