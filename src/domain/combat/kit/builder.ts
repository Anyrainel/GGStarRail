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
  | "enemyDefeated"
  | "perCycle"
  /** A teammate the user designates; the value is its Character ID. */
  | "ally";

export interface OptionDef {
  /** Unique within the entity. */
  id: string;
  origin: EffectOrigin;
  condition: OptionCondition;
  /** Percent threshold for HP conditions (0.5 = 50%). */
  threshold?: number;
  /**
   * `true/false` for toggles, a number for counts, a Character ID (or null
   * without candidates) for ally choices.
   */
  defaultValue: boolean | number | string | null;
  max?: number;
  /** Ally choices: the Character IDs that may be designated. */
  choices?: readonly string[];
}

export type OptionValues = Readonly<Record<string, boolean | number | string>>;

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

  /**
   * A teammate the user designates ("one designated ally"). `pick` gives
   * the default among the candidates: the other team members, plus the
   * kit's own Character with `includeSelf`. Returns the chosen member, or
   * null when there is no candidate. Find its unit at runtime by `slot`.
   */
  ally(
    id: string,
    origin: EffectOrigin,
    pick: (candidates: readonly TeamMemberInfo[]) => TeamMemberInfo | undefined,
    options: { includeSelf?: boolean } = {}
  ): TeamMemberInfo | null {
    const own = this.ownCharacterId();
    const candidates = this.team.filter(
      (member) => options.includeSelf || member.characterId !== own
    );
    const fallback = pick(candidates) ?? candidates[0] ?? null;
    this.declareOption({
      id,
      origin,
      condition: "ally",
      defaultValue: fallback?.characterId ?? null,
      choices: candidates.map((member) => member.characterId),
    });
    const value = this.optionValues[id];
    return (
      candidates.find((member) => member.characterId === value) ?? fallback
    );
  }

  /** The Character this kit belongs to or is worn by (canonical ID). */
  protected ownCharacterId(): string | null {
    return null;
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
  /**
   * A countdown or marker (Concerto, Supreme Stance, Complete Combustion)
   * rather than an in-game summon (Lightning-Lord, Numby, Fuyuan).
   */
  countdown?: boolean;
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
