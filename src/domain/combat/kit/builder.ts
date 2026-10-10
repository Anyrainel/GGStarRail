import type { CombatType } from "../model/stats";
import type {
  AbilityDef,
  BattleEventType,
  EventFilter,
  EventHandler,
  PermanentModifier,
  TurnPolicy,
  UltimatePolicy,
} from "./api";
import type { EffectOrigin, ModifierDef, StatusDef } from "./model";

/**
 * User-facing conditions use a shared vocabulary so options stay localized
 * without per-entity strings: the UI shows the effect origin (with its game
 * text on hover) plus one of these condition labels.
 */
export type OptionCondition =
  | "active"
  | "stacks"
  | "enemyHpBelow"
  | "enemyHpAbove"
  | "selfHpBelow"
  | "selfHpAbove"
  | "perCycle";

export interface OptionDef {
  /** Unique within the entity. */
  id: string;
  origin: EffectOrigin;
  condition: OptionCondition;
  /** Percent threshold for HP conditions (0.5 = 50%). */
  threshold?: number;
  /** `true/false` for toggles, a number for counts. */
  defaultValue: boolean | number;
  max?: number;
}

export type OptionValues = Readonly<Record<string, boolean | number>>;

export interface ListenerDef {
  event: BattleEventType;
  filter: EventFilter;
  handler: EventHandler;
  origin: EffectOrigin;
}

export interface TeamModifier extends PermanentModifier {
  /** `allies` includes the provider; `otherAllies` excludes it. */
  scope: "allies" | "otherAllies";
  /** Restrict to allies of these Combat Types / Paths. */
  combatTypes?: readonly CombatType[];
  paths?: readonly string[];
}

export interface CompiledKit {
  readonly permanent: readonly PermanentModifier[];
  readonly team: readonly TeamModifier[];
  readonly statuses: readonly StatusDef[];
  readonly listeners: readonly ListenerDef[];
  readonly options: readonly OptionDef[];
}

/** One team member, as kits may inspect it ("for each Nihility ally"). */
export interface TeamMemberInfo {
  readonly characterId: string;
  readonly pathId: string;
  readonly combatType: string;
  readonly slot: number;
}

/** Shared declarations for Characters, Light Cones, and Relic sets. */
export class KitBuilder {
  protected readonly permanentModifiers: PermanentModifier[] = [];
  protected readonly teamModifiers: TeamModifier[] = [];
  protected readonly statusDefs: StatusDef[] = [];
  protected readonly listenerDefs: ListenerDef[] = [];
  protected readonly optionDefs: OptionDef[] = [];

  constructor(
    protected readonly optionValues: OptionValues = {},
    /** The whole team, including this kit's own Character. */
    readonly team: readonly TeamMemberInfo[] = []
  ) {}

  /** Team members on a Path (catalog IDs: Rogue = The Hunt, Warlock = Nihility, ...). */
  countPath(pathId: string): number {
    return this.team.filter((member) => member.pathId === pathId).length;
  }

  countCombatType(combatType: string): number {
    return this.team.filter((member) => member.combatType === combatType)
      .length;
  }

  /** An unconditional modifier on this unit for the whole battle. */
  stat(origin: EffectOrigin, modifier: ModifierDef): void {
    this.permanentModifiers.push({ ...modifier, origin });
  }

  /** An unconditional modifier on every ally (or every other ally). */
  teamStat(
    origin: EffectOrigin,
    modifier: ModifierDef,
    scope: TeamModifier["scope"] = "allies",
    restrict: Pick<TeamModifier, "combatTypes" | "paths"> = {}
  ): void {
    this.teamModifiers.push({ ...modifier, origin, scope, ...restrict });
  }

  status(definition: StatusDef): StatusDef {
    if (this.statusDefs.some((status) => status.id === definition.id)) {
      throw new Error(`Duplicate status ${definition.id}`);
    }
    this.statusDefs.push(definition);
    return definition;
  }

  on(
    event: BattleEventType,
    origin: EffectOrigin,
    filter: EventFilter,
    handler: EventHandler
  ): void {
    this.listenerDefs.push({ event, filter, handler, origin });
  }

  /** A user toggle with a peak-damage default. */
  toggle(
    id: string,
    origin: EffectOrigin,
    condition: OptionCondition,
    defaultValue: boolean,
    threshold?: number
  ): boolean {
    this.declareOption({ id, origin, condition, defaultValue, threshold });
    const value = this.optionValues[id];
    return typeof value === "boolean" ? value : defaultValue;
  }

  /** A user count (stacks, procs per cycle) clamped to `[0, max]`. */
  count(
    id: string,
    origin: EffectOrigin,
    condition: OptionCondition,
    defaultValue: number,
    max: number
  ): number {
    this.declareOption({ id, origin, condition, defaultValue, max });
    const value = this.optionValues[id];
    return typeof value === "number"
      ? Math.min(max, Math.max(0, value))
      : defaultValue;
  }

  protected compileShared(): CompiledKit {
    return {
      permanent: this.permanentModifiers,
      team: this.teamModifiers,
      statuses: this.statusDefs,
      listeners: this.listenerDefs,
      options: this.optionDefs,
    };
  }

  private declareOption(option: OptionDef): void {
    if (this.optionDefs.some((entry) => entry.id === option.id)) {
      throw new Error(`Duplicate option ${option.id}`);
    }
    this.optionDefs.push(option);
  }
}

export interface MemospriteDef {
  /** Servant ID from the catalog (e.g. "11402"). */
  servantId: string;
  /** Memosprite SPD: a fraction of the owner's SPD plus flat, or fixed. */
  speed: { ownerRatio?: number; flat?: number };
  /** HP is not modeled for damage; kept for display completeness. */
  abilities: readonly AbilityDef[];
  policy?: TurnPolicy;
  /** Present from battle start (default: summoned by the kit). */
  presentAtStart?: boolean;
}

/** Action-order entities without stats (countdowns, Lightning-Lord, Numby). */
export interface SummonDef {
  id: string;
  speed: number;
  /** Runs on the summon's turn; it acts with its owner's stats. */
  abilities: readonly AbilityDef[];
  policy: TurnPolicy;
  presentAtStart?: boolean;
}

export interface CompiledCharacterKit extends CompiledKit {
  readonly abilities: ReadonlyMap<string, AbilityDef>;
  readonly memosprites: readonly MemospriteDef[];
  readonly summons: readonly SummonDef[];
  readonly turnPolicy: TurnPolicy;
  readonly ultimatePolicy: UltimatePolicy;
  readonly startingEnergy: number;
}
