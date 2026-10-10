import type { CombatStat, CombatType } from "../model/stats";
import type { DamageTag, StatusFamily, UnitKind } from "../model/tags";
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
  /** Path ID of the Character (memosprites and summons: the owner's). */
  readonly pathId: string;
  /** Team slot of the Character this unit belongs to (-1 for enemies). */
  readonly slot: number;
  readonly owner: UnitView | null;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly speed: number;
  readonly inActionOrder: boolean;
  /** Remaining action-gauge distance (10000 = a full turn away). */
  readonly actionGauge: number;
  /** Stacks of a status on this unit (0 when absent). */
  stacks(status: StatusDef, applier?: UnitView): number;
  has(status: StatusDef, applier?: UnitView): boolean;
  /** Turns left on a status; null when it has no duration or is absent. */
  remainingTurns(status: StatusDef, applier?: UnitView): number | null;
  /** Whether any status of the family is on this unit, from any source. */
  hasFamily(family: StatusFamily): boolean;
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
  /**
   * Base chance for debuffs; expected value scales effects below 100%.
   * Re-applying without a base chance makes the debuff certain; use
   * `setStatusStacks` to change stacks without a new application.
   */
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
  /**
   * Breakdown row and ability kind. Inside an ability's `before`/`after`
   * they default to that ability; elsewhere to `<origin>:<Character ID>`
   * and `other`.
   */
  abilityId?: string;
  abilityKind?: AbilityKind;
  origin?: EffectOrigin;
  /** Expected occurrences, multiplied with the trigger's weight. */
  weight?: number;
}

export interface ToughnessOptions {
  /** Fraction applied against enemies without the matching Weakness. */
  withoutWeakness?: number;
  /** Skip Weakness Break Efficiency ("fixed Toughness reduction"). */
  fixed?: boolean;
  /** Combat Type of the reduction; default the unit's own. */
  combatType?: CombatType;
  origin?: EffectOrigin;
  abilityId?: string;
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
  readonly maxSkillPoints: number;
  readonly cycle: number;
  /** Action value elapsed since battle start. */
  readonly time: number;
  /** The engine's designated target (the middle enemy). */
  readonly mainTarget: EnemyView | null;
  /**
   * Probability mass of the current trigger (1 unless random). Energy,
   * Skill Points, counters, action advance, and `deal` scale with it;
   * `applyStatus` does not (pass weighted stacks explicitly).
   */
  readonly weight: number;

  applyStatus(
    target: UnitView,
    status: StatusDef,
    options?: ApplyStatusOptions
  ): void;
  removeStatus(target: UnitView, status: StatusDef): void;
  consumeStacks(target: UnitView, status: StatusDef, stacks: number): void;
  /** Adds turns to every instance of a timed status on the target. */
  extendStatus(target: UnitView, status: StatusDef, turns: number): void;
  /**
   * Set the stacks of an existing status without a new application: its
   * duration, landing chance, and `statusApplied` listeners are untouched.
   */
  setStatusStacks(target: UnitView, status: StatusDef, stacks: number): void;

  /** Returns the Energy lost to the cap (overflow), after ERR. */
  gainEnergy(
    unit: UnitView,
    amount: number,
    options?: { fixed?: boolean }
  ): number;
  setEnergy(unit: UnitView, amount: number): void;
  gainSkillPoints(amount: number): void;
  /** Raise or lower the team's Skill Point cap (default 5). */
  setMaxSkillPoints(max: number): void;

  advanceAction(unit: UnitView, fraction: number): void;
  delayAction(unit: UnitView, fraction: number): void;
  /**
   * Extra turns accumulate expected occurrences: a 50% trigger grants one
   * extra turn every second time.
   */
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
  reduceToughness(
    target: EnemyView,
    amount: number,
    options?: ToughnessOptions
  ): void;
  /** Add a Weakness, for `turns` of the enemy's turns when given. */
  implantWeakness(
    target: EnemyView,
    combatType: CombatType,
    options?: { turns?: number }
  ): void;
  removeWeakness(target: EnemyView, combatType: CombatType): void;

  addCounter(unit: UnitView, name: string, delta: number, max?: number): void;
  setCounter(unit: UnitView, name: string, value: number): void;
  /** Team-shared resources such as Punchline. */
  teamResource(name: string): number;
  addTeamResource(name: string, delta: number, max?: number): void;

  /** Summon or re-summon (restarting a countdown's gauge). */
  summon(owner: UnitView, servantId: string): UnitView;
  /** An active summon or memosprite, without touching its gauge. */
  findSummon(owner: UnitView, servantId: string): UnitView | null;
  dismiss(unit: UnitView): void;

  /**
   * Aha takes an extra turn after the current action, counting a fixed
   * Punchline (the team's Punchline is neither used nor consumed).
   */
  ahaExtraTurn(punchline: number): void;
  /** Grant a Certified Banger state worth `value` Punchline (default 2 turns). */
  grantCertifiedBanger(unit: UnitView, value: number, turns?: number): void;
}

/** Context of an ability being executed. */
export interface ActionContext extends BattleApi {
  readonly abilityId: string;
  readonly abilityKind: AbilityKind;
  readonly target: EnemyView | UnitView | null;
  /** Values shared between `before`, `afterHit`, and `after` of one use. */
  readonly scratch: Map<string, unknown>;
  /** Enemies hit so far by this action (Blast and AoE targets included). */
  targetsHit(): readonly EnemyView[];
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
  | "statusRemoved"
  | "summoned"
  | "departed"
  | "dotTick"
  | "teamResourceChanged"
  | "skillPointsChanged"
  | "ahaInstantStart"
  | "ahaInstantEnd";

export interface BattleEvent {
  readonly type: BattleEventType;
  /** The acting or affected unit. */
  readonly unit: UnitView;
  readonly target?: UnitView;
  readonly abilityId?: string;
  readonly abilityKind?: AbilityKind;
  /**
   * `actionStart`/`actionEnd`: what the ability is aimed at, as declared.
   * `ally` is one ally; `target` is that ally when the policy named one.
   */
  readonly abilityTarget?: AbilityTarget;
  readonly tags?: readonly DamageTag[];
  readonly status?: StatusDef;
  /** Whether the action dealt damage to enemies (counts as an attack). */
  readonly attack?: boolean;
  readonly resource?: string;
  /** Change of a team resource or of Skill Points (+ gained, − spent). */
  readonly delta?: number;
  /** `actionEnd`: every enemy the action hit. */
  readonly targetsHit?: readonly EnemyView[];
  /** `dotTick`: a detonation rather than the turn-start tick. */
  readonly detonation?: boolean;
  /** `turnStart`/`turnEnd`: an extra turn. */
  readonly extraTurn?: boolean;
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
  /**
   * Further condition on the event, checked before limits: when it returns
   * false the listener neither runs nor uses up a limit ("after an ally
   * attacks an enemy with X, once per turn").
   */
  when?: (event: BattleEvent, self: UnitView) => boolean;
  /**
   * Trigger at most N times per turn of any unit / per action / between two
   * turn starts of the kit's own unit. Limits count expected occurrences:
   * a 30% trigger uses 0.3 of the limit, and the last trigger is scaled to
   * what remains.
   */
  limitPerTurn?: number;
  limitPerAction?: number;
  limitPerOwnTurn?: number;
}

export type EventHandler = (ctx: BattleApi, event: BattleEvent) => void;

export interface AbilityDef {
  id: string;
  kind: AbilityKind;
  /** Display origin; default derived from `kind`. */
  origin?: EffectOrigin;
  target?: AbilityTarget;
  /**
   * Tags added to the defaults of `kind` ("this DMG is considered Ultimate
   * DMG"), as on hits.
   */
  tags?: readonly DamageTag[];
  /** Replaces the tags entirely ("this DMG is not considered Skill DMG"). */
  onlyTags?: readonly DamageTag[];
  /** Static hits, or hits computed after `before` from battle state. */
  hits?: readonly HitDef[] | ((ctx: ActionContext) => readonly HitDef[]);
  /** Whether the ability attacks; default: it has static hits. */
  attack?: boolean;
  /** Runs after each HitDef resolves (index into the hits). */
  afterHit?: (ctx: ActionContext, index: number) => void;
  /** Skill Points gained (+) or consumed (−); default by kind. */
  skillPoints?: number;
  /** Energy regenerated (ERR-scaled); default by kind. */
  energy?: number;
  /** Ultimate cost override; default the Character's max Energy. */
  energyCost?: number;
  /**
   * Ultimates paid with a kit resource instead of Energy (e.g. Flying
   * Aureus): a counter on the unit and the amount spent.
   */
  resource?: { counter: string; amount: number };
  /** Cast the Ultimate even while out of the Action Order (Departed). */
  castOutsideActionOrder?: boolean;
  /**
   * Ultimates: whether it can be cast now. Turn abilities: whether the turn
   * policy's choice is allowed; otherwise the turn falls back to Basic ATK.
   */
  usable?: (view: PolicyView) => boolean;
  before?: (ctx: ActionContext) => void;
  after?: (ctx: ActionContext) => void;
  /**
   * `false`: the turn continues after this ability ("does not end the
   * turn"); Ultimates may be cast before the policy picks the next one.
   */
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
  readonly mainTarget: EnemyView | null;
  /** The unit about to take its turn, when Ultimates are checked before it. */
  readonly upcoming: UnitView | null;
  /** The current turn is an extra turn. */
  readonly extraTurn: boolean;
  /** Abilities already used in this turn (turns that do not end). */
  readonly usedThisTurn: readonly string[];
  teamResource(name: string): number;
}

/** A turn choice with a designated target (an ally for ally abilities). */
export interface TurnChoice {
  ability: string;
  target?: UnitView;
}

/** Choose the ability for a turn; return an ability ID or a choice. */
export type TurnPolicy = (view: PolicyView) => string | TurnChoice;
/**
 * Decide whether to cast the Ultimate now (energy permitting). Return the
 * ID of an Ultimate variant to cast that one instead of `ultimate`, or a
 * choice to aim it at an ally.
 */
export type UltimatePolicy = (
  view: PolicyView
) => boolean | string | TurnChoice;

export interface PermanentModifier extends ModifierDef {
  origin: EffectOrigin;
}

export function isEnemy(view: UnitView | null | undefined): view is EnemyView {
  return view?.kind === "enemy";
}
