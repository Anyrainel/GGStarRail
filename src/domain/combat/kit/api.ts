import type { CombatStat, CombatType } from "../model/stats";
import type { DamageTag, UnitKind } from "../model/tags";
import type {
  AbilityKind,
  AbilityTarget,
  EffectOrigin,
  HitDef,
  ModifierDef,
  StatusDef,
} from "./model";

/** Read-only view of a combat unit exposed to kit handlers and policies. */
export interface UnitView {
  readonly id: string;
  readonly kind: UnitKind;
  /** Catalog ID of the Character, memosprite servant, or summon. */
  readonly definitionId: string;
  readonly combatType: CombatType;
  readonly owner: UnitView | null;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly speed: number;
  readonly inActionOrder: boolean;
  /** Stacks of a status on this unit (0 when absent). */
  stacks(status: StatusDef, applier?: UnitView): number;
  has(status: StatusDef, applier?: UnitView): boolean;
  /** Debuffs currently on this unit. */
  debuffCount(): number;
  /** Steady panel value of a stat (no momentary statuses). */
  panelStat(stat: CombatStat | "hp" | "atk" | "def" | "spd"): number;
  /** Kit-owned counter (e.g. charges, points) stored on the unit. */
  counter(name: string): number;
  /** Sum of this unit's Certified Banger values (Elation). */
  certifiedBanger(): number;
}

export interface EnemyView extends UnitView {
  readonly toughness: number;
  readonly maxToughness: number;
  readonly broken: boolean;
  readonly weaknesses: ReadonlySet<CombatType>;
}

export interface ApplyStatusOptions {
  stacks?: number;
  /** Set stacks to exactly this value instead of adding. */
  setStacks?: number;
  /** Override the definition's duration for this application. */
  turns?: number;
  /** Base chance for debuffs; expected value scales effects below 100%. */
  baseChance?: number;
}

export interface DealOptions {
  /** Targets; default is the action's main target. */
  targets?: readonly EnemyView[];
  /**
   * Unit credited with the damage and whose stats scale it (default: the
   * kit's own unit). Joint ATKs deal the memosprite's part this way.
   */
  attacker?: UnitView;
  tags?: readonly DamageTag[];
  /** Ability kind used for "after using X" triggers; default `other`. */
  abilityKind?: AbilityKind;
  origin?: EffectOrigin;
}

/**
 * Battle operations available to kit code. Every operation is deterministic;
 * probabilistic effects carry `weight` (expected occurrences).
 */
export interface BattleApi {
  readonly self: UnitView;
  readonly allies: readonly UnitView[];
  readonly enemies: readonly EnemyView[];
  readonly skillPoints: number;
  readonly cycle: number;
  /** Probability mass of the current trigger (1 unless random). */
  readonly weight: number;

  applyStatus(
    target: UnitView,
    status: StatusDef,
    options?: ApplyStatusOptions
  ): void;
  removeStatus(target: UnitView, status: StatusDef): void;
  consumeStacks(target: UnitView, status: StatusDef, stacks: number): void;

  gainEnergy(
    unit: UnitView,
    amount: number,
    options?: { fixed?: boolean }
  ): void;
  setEnergy(unit: UnitView, amount: number): void;
  gainSkillPoints(amount: number): void;

  advanceAction(unit: UnitView, fraction: number): void;
  delayAction(unit: UnitView, fraction: number): void;
  grantExtraTurn(unit: UnitView): void;
  /** Leave or rejoin the Action Order (e.g. during a channel). */
  setInActionOrder(unit: UnitView, inOrder: boolean): void;

  /** Queue an ability of `unit` right after the current action. */
  queueAction(
    unit: UnitView,
    abilityId: string,
    options?: { target?: EnemyView; weight?: number }
  ): void;
  /** Deal damage now without a separate action (Additional DMG, procs). */
  deal(hit: HitDef, options?: DealOptions): void;
  /** Immediately deal a DoT's damage `ratio` times ("detonate"). */
  detonateDots(
    target: EnemyView,
    ratio: number,
    options?: { filter?: (status: StatusDef) => boolean }
  ): void;
  reduceToughness(target: EnemyView, amount: number): void;
  implantWeakness(target: EnemyView, combatType: CombatType): void;

  addCounter(unit: UnitView, name: string, delta: number, max?: number): void;
  setCounter(unit: UnitView, name: string, value: number): void;
  /** Team-shared resources such as Punchline. */
  teamResource(name: string): number;
  addTeamResource(name: string, delta: number, max?: number): void;

  summon(owner: UnitView, servantId: string): UnitView;
  dismiss(unit: UnitView): void;

  /** Grant a Certified Banger state worth `value` Punchline (default 2 turns). */
  grantCertifiedBanger(unit: UnitView, value: number, turns?: number): void;
}

/** Context of an ability being executed. */
export interface ActionContext extends BattleApi {
  readonly abilityId: string;
  readonly abilityKind: AbilityKind;
  readonly target: EnemyView | UnitView | null;
}

export type BattleEventType =
  | "battleStart"
  | "turnStart"
  | "turnEnd"
  | "actionStart"
  | "actionEnd"
  | "hit"
  | "weaknessBreak"
  | "enemyAttack"
  | "hitByEnemy"
  | "statusApplied"
  | "dotTick"
  | "teamResourceChanged"
  | "ahaInstantStart"
  | "ahaInstantEnd";

export interface BattleEvent {
  readonly type: BattleEventType;
  /** The acting or affected unit. */
  readonly unit: UnitView;
  readonly target?: UnitView;
  readonly abilityId?: string;
  readonly abilityKind?: AbilityKind;
  readonly tags?: readonly DamageTag[];
  readonly status?: StatusDef;
  /** Whether the action dealt damage to enemies (counts as an attack). */
  readonly attack?: boolean;
  readonly resource?: string;
  readonly delta?: number;
  readonly weight: number;
}

/** Who an event listener reacts to, relative to the kit's own unit. */
export type EventSubject =
  | "self"
  | "selfOrMemosprite"
  | "memosprite"
  | "ally"
  | "otherAlly"
  | "enemy"
  | "any";

export interface EventFilter {
  subject?: EventSubject;
  abilityKinds?: readonly AbilityKind[];
  tags?: readonly DamageTag[];
  /** Only actions that attacked an enemy. */
  attack?: boolean;
  status?: StatusDef;
  resource?: string;
  /** Trigger at most N times per turn of any unit / per action. */
  limitPerTurn?: number;
  limitPerAction?: number;
}

export type EventHandler = (ctx: BattleApi, event: BattleEvent) => void;

export interface AbilityDef {
  id: string;
  kind: AbilityKind;
  /** Display origin; default derived from `kind`. */
  origin?: EffectOrigin;
  target?: AbilityTarget;
  /** Replaces the default tags for `kind`. */
  tags?: readonly DamageTag[];
  hits?: readonly HitDef[];
  /** Skill Points gained (+) or consumed (−); default by kind. */
  skillPoints?: number;
  /** Energy regenerated (ERR-scaled); default by kind. */
  energy?: number;
  /** Ultimate cost override; default the Character's max Energy. */
  energyCost?: number;
  usable?: (view: PolicyView) => boolean;
  before?: (ctx: ActionContext) => void;
  after?: (ctx: ActionContext) => void;
  /** Does using it end the turn? Default: basic/skill/memosprite skill. */
  endsTurn?: boolean;
}

/** State a policy may read when choosing actions. */
export interface PolicyView {
  readonly self: UnitView;
  readonly allies: readonly UnitView[];
  readonly enemies: readonly EnemyView[];
  readonly skillPoints: number;
  readonly maxSkillPoints: number;
  readonly cycle: number;
  readonly time: number;
  teamResource(name: string): number;
}

/** Choose the ability for a turn; return an ability ID. */
export type TurnPolicy = (view: PolicyView) => string;
/** Decide whether to cast the Ultimate now (energy permitting). */
export type UltimatePolicy = (view: PolicyView) => boolean;

export interface PermanentModifier extends ModifierDef {
  origin: EffectOrigin;
}

export function isEnemy(view: UnitView | null | undefined): view is EnemyView {
  return view?.kind === "enemy";
}
