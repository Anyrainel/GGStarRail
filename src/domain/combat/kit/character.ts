import { bonusAbilityTraceId } from "@/domain/account/traces";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import { isCombatTypeId } from "@/domain/stats";
import type { CharacterData } from "../model/data";
import type { AbilityDef, PolicyView, TurnPolicy, UltimatePolicy } from "./api";
import {
  type CompiledCharacterKit,
  KitBuilder,
  type MemospriteDef,
  type OptionValues,
  type SummonDef,
  type TeamMemberInfo,
} from "./builder";
import { SkillLevels } from "./skillLevels";

export interface CharacterProgress {
  eidolon: number;
  /** Account trace record (catalog point IDs); empty means unknown. */
  traces: Readonly<Record<string, number>>;
}

/** Skill when a Skill Point is available, otherwise Basic ATK. */
export const preferSkill: TurnPolicy = (view: PolicyView) =>
  view.skillPoints >= 1 ? "skill" : "basic";

export const alwaysBasic: TurnPolicy = () => "basic";

export const ultimateWhenReady: UltimatePolicy = () => true;

/**
 * The surface a Character translation is written against. Numbers come from
 * the catalog through `param`, `rankParam`, and `traceParam`; translations
 * only hard-code values the game text states without a parameter.
 */
export class CharacterKitBuilder extends KitBuilder {
  readonly id: string;
  readonly eidolon: number;
  readonly combatType;
  readonly levels: SkillLevels;
  private readonly abilityDefs = new Map<string, AbilityDef>();
  private readonly memospriteDefs: MemospriteDef[] = [];
  private readonly summonDefs: SummonDef[] = [];
  private turn: TurnPolicy = preferSkill;
  private ultimate: UltimatePolicy = ultimateWhenReady;
  private energyAtStart = 0.5;

  constructor(
    readonly data: CharacterData,
    private readonly progress: CharacterProgress,
    options: OptionValues = {},
    team: readonly TeamMemberInfo[] = []
  ) {
    super(options, team);
    if (!isCombatTypeId(data.combat_type_id)) {
      throw new Error(`Unknown Combat Type ${data.combat_type_id}`);
    }
    this.id = data.id;
    this.combatType = data.combat_type_id;
    this.eidolon = progress.eidolon;
    this.levels = new SkillLevels(data, progress.eidolon, progress.traces);
  }

  protected override ownCharacterId(): string {
    return canonicalCharacterId(this.id);
  }

  /** `#index` of a skill at its effective level (Eidolon bonuses included). */
  param(skillId: string, index: number): number {
    return this.levels.param(skillId, index);
  }

  /** `#index` of Eidolon `rank` (1–6). */
  rankParam(rank: number, index: number): number {
    const value = this.data.ranks.find((entry) => entry.rank === rank)
      ?.parameters[index - 1];
    if (value === undefined) {
      throw new Error(`Eidolon ${rank} of ${this.id} has no #${index}`);
    }
    return value;
  }

  /** `#index` of Bonus Ability `n` (1 = A2, 2 = A4, 3 = A6). */
  traceParam(n: 1 | 2 | 3, index: number): number {
    const traceId = bonusAbilityTraceId(this.id, n);
    const value = this.data.traces.find((trace) => trace.id === traceId)
      ?.levels[0]?.parameters[index - 1];
    if (value === undefined) {
      throw new Error(`Bonus Ability ${traceId} has no #${index}`);
    }
    return value;
  }

  /** Eidolon `n` is active. */
  e(n: number): boolean {
    return this.eidolon >= n;
  }

  /** Bonus Ability `n` is unlocked (assumed when the source did not say). */
  a(n: 1 | 2 | 3): boolean {
    return this.progress.traces[bonusAbilityTraceId(this.id, n)] !== 0;
  }

  ability(definition: AbilityDef): AbilityDef {
    if (this.abilityDefs.has(definition.id)) {
      throw new Error(`Duplicate ability ${definition.id} on ${this.id}`);
    }
    this.abilityDefs.set(definition.id, definition);
    return definition;
  }

  memosprite(definition: MemospriteDef): void {
    this.memospriteDefs.push(definition);
  }

  summon(definition: SummonDef): SummonDef {
    this.summonDefs.push(definition);
    return definition;
  }

  policy(policies: { turn?: TurnPolicy; ultimate?: UltimatePolicy }): void {
    if (policies.turn) this.turn = policies.turn;
    if (policies.ultimate) this.ultimate = policies.ultimate;
  }

  /** Fraction of max Energy at battle start (default 50%). */
  startingEnergy(fraction: number): void {
    this.energyAtStart = fraction;
  }

  compile(): CompiledCharacterKit {
    for (const required of ["basic"]) {
      if (!this.abilityDefs.has(required)) {
        throw new Error(`Character ${this.id} must define "${required}"`);
      }
    }
    return {
      ...this.compileShared(),
      abilities: this.abilityDefs,
      memosprites: this.memospriteDefs,
      summons: this.summonDefs,
      turnPolicy: this.turn,
      ultimatePolicy: this.ultimate,
      startingEnergy: this.energyAtStart,
    };
  }
}

export interface CharacterKitDefinition {
  readonly type: "character";
  readonly id: string;
  build(k: CharacterKitBuilder): void;
}

export function defineCharacter(
  id: string,
  build: (k: CharacterKitBuilder) => void
): CharacterKitDefinition {
  return { type: "character", id, build };
}
