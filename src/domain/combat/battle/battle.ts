import type {
  AbilityDef,
  ActionContext,
  ApplyStatusOptions,
  BattleApi,
  BattleEvent,
  DealOptions,
  EnemyView,
  EventFilter,
  PolicyView,
  ToughnessOptions,
  TurnChoice,
  UnitView,
} from "../kit/api";
import type { ListenerDef } from "../kit/builder";
import {
  type AbilityKind,
  DEFAULT_ABILITY_TAGS,
  DEFAULT_ENERGY,
  DEFAULT_SKILL_POINTS,
  type EffectOrigin,
  type HitDef,
  type StatusDef,
} from "../kit/model";
import {
  type CombatStat,
  type CombatType,
  combineStat,
  readStat,
} from "../model/stats";
import type { DamageTag, TargetRole } from "../model/tags";
import { BREAK_EFFECT_STATUS, breakEffectFor } from "./breakEffects";
import type { ActionRecord, BreakEffect, CombatLog, HitRecord } from "./log";
import {
  ACTION_GAUGE,
  type CombatUnit,
  type EffectSource,
  type EnemyUnit,
  StatusInstance,
} from "./units";

export interface RegisteredListener {
  readonly owner: CombatUnit;
  readonly def: ListenerDef;
  readonly source: EffectSource;
  /** Expected firings in the current turn / action / owner's turn cycle. */
  fired: number;
  firedInAction: number;
  firedInOwnTurn: number;
}

export interface BattleOptions {
  cycles: number;
  startingSkillPoints: number;
  maxSkillPoints: number;
  /** Energy an ally gains when the enemy attack lands on it (before ERR). */
  enemyAttackEnergy: number;
  /** First cycle length in action value (Memory of Chaos: 150). */
  firstCycle: number;
  cycleLength: number;
  /**
   * Punchline gained at battle start and after each Aha action, per Elation
   * Character present. The game scales both with the Elation count; exact
   * amounts are not in the reference data yet (tracked as needs-data).
   */
  punchlinePerElationCharacter: number;
}

export const DEFAULT_BATTLE_OPTIONS: BattleOptions = {
  cycles: 3,
  startingSkillPoints: 3,
  maxSkillPoints: 5,
  enemyAttackEnergy: 10,
  firstCycle: 150,
  cycleLength: 100,
  punchlinePerElationCharacter: 0,
};

interface QueuedAction {
  unit: CombatUnit;
  abilityId: string;
  target: EnemyUnit | null;
  weight: number;
}

const MAX_ACTIONS = 2000;
const ULTIMATE_PASSES = 8;
/** Abilities one turn may chain when they do not end the turn. */
const MAX_TURN_ABILITIES = 12;

/** Defaults `deal` uses inside an ability's own callbacks. */
interface DealDefaults {
  abilityId: string;
  abilityKind: AbilityKind;
  origin: EffectOrigin;
}

/** Turn-based, deterministic battle producing a hit ledger. */
export class Battle {
  readonly allies: CombatUnit[] = [];
  readonly summons: CombatUnit[] = [];
  readonly enemies: EnemyUnit[];
  readonly listeners: RegisteredListener[] = [];
  readonly hits: HitRecord[] = [];
  readonly actions: ActionRecord[] = [];
  readonly warnings: string[] = [];
  readonly sources = new Map<CombatUnit, EffectSource>();
  readonly statusSources = new Map<StatusDef, EffectSource>();
  readonly teamResources = new Map<string, number>();
  readonly servantFactories = new Map<
    string,
    (owner: CombatUnit) => CombatUnit
  >();
  /** Units that left the battle; their hits stay evaluable. */
  readonly retired: CombatUnit[] = [];
  /** Applies team-wide permanent modifiers to newly summoned units. */
  onUnitCreated: ((unit: CombatUnit) => void) | null = null;
  /** Aha joins the Action Order once Punchline is first gained. */
  aha: CombatUnit | null = null;
  time = 0;
  skillPoints: number;
  maxSkillPoints: number;
  private readonly queue: QueuedAction[] = [];
  private readonly extraTurns: CombatUnit[] = [];
  /** Aha extra turns granted by kits, with their fixed Punchline. */
  private readonly ahaExtraTurns: number[] = [];
  private actionCount = 0;
  private currentActor: CombatUnit | null = null;
  private currentExtraTurn = false;
  private usedThisTurn: string[] = [];
  /** The unit about to act while pre-turn Ultimates are checked. */
  private upcoming: CombatUnit | null = null;
  /** Enemies hit by the action being executed. */
  private targetsHit: Set<EnemyUnit> | null = null;
  private readonly endTime: number;

  constructor(
    characters: readonly CombatUnit[],
    enemies: readonly EnemyUnit[],
    readonly options: BattleOptions
  ) {
    this.allies.push(...characters);
    this.enemies = [...enemies];
    this.skillPoints = options.startingSkillPoints;
    this.maxSkillPoints = options.maxSkillPoints;
    this.endTime =
      options.firstCycle +
      options.cycleLength * Math.max(0, options.cycles - 1);
  }

  get cycle(): number {
    if (this.time <= this.options.firstCycle) return 0;
    return (
      1 +
      Math.floor(
        (this.time - this.options.firstCycle - 1e-9) / this.options.cycleLength
      )
    );
  }

  get mainTarget(): EnemyUnit | null {
    return this.enemies[Math.floor((this.enemies.length - 1) / 2)] ?? null;
  }

  addListener(owner: CombatUnit, def: ListenerDef, source: EffectSource): void {
    this.listeners.push({
      owner,
      def,
      source,
      fired: 0,
      firedInAction: 0,
      firedInOwnTurn: 0,
    });
  }

  run(): CombatLog {
    const elation = this.elationCharacters().length;
    if (
      this.aha &&
      elation > 0 &&
      this.options.punchlinePerElationCharacter > 0
    ) {
      this.changeTeamResource(
        this.aha,
        "punchline",
        this.options.punchlinePerElationCharacter * elation,
        undefined,
        1,
        null
      );
    }
    this.emit(
      {
        type: "battleStart",
        unit: this.allies[0] ?? this.enemies[0]!,
        weight: 1,
      },
      null
    );
    this.checkUltimates();
    while (this.actionCount < MAX_ACTIONS) {
      const actor = this.nextActor();
      if (!actor) break;
      const wait = actor.distance / actor.speed;
      if (this.time + wait > this.endTime + 1e-9) break;
      this.advanceTime(wait);
      this.upcoming = actor;
      this.checkUltimates();
      this.upcoming = null;
      // An Ultimate may grant an extra turn that comes before this turn.
      this.processExtraTurns();
      this.takeTurn(actor, "turn");
      this.processExtraTurns();
      this.checkUltimates();
    }
    if (this.actionCount >= MAX_ACTIONS) {
      this.warnings.push("action-limit");
    }
    return {
      hits: this.hits,
      actions: this.actions,
      duration: Math.min(this.time, this.endTime),
      cycles: this.options.cycles,
      warnings: this.warnings,
    };
  }

  // ---------------------------------------------------------------------
  // Action order

  private orderedUnits(): CombatUnit[] {
    return [...this.allies, ...this.summons, ...this.enemies].filter(
      (unit) => unit.inActionOrder
    );
  }

  private nextActor(): CombatUnit | null {
    let best: CombatUnit | null = null;
    let bestWait = Number.POSITIVE_INFINITY;
    for (const unit of this.orderedUnits()) {
      const wait = unit.distance / unit.speed;
      if (wait < bestWait - 1e-9) {
        best = unit;
        bestWait = wait;
      }
    }
    return best;
  }

  private advanceTime(wait: number): void {
    if (wait <= 0) return;
    for (const unit of this.orderedUnits()) {
      unit.distance = Math.max(0, unit.distance - wait * unit.speed);
    }
    this.time += wait;
  }

  currentTurnUnit(): CombatUnit | null {
    return this.currentActor;
  }

  private processExtraTurns(): void {
    while (this.extraTurns.length > 0) {
      const unit = this.extraTurns.shift();
      if (!unit) break;
      this.checkUltimates();
      this.takeTurn(unit, "extraTurn");
    }
  }

  // ---------------------------------------------------------------------
  // Turns

  private takeTurn(unit: CombatUnit, mode: "turn" | "extraTurn"): void {
    this.actionCount += 1;
    this.resetTurnLimits(unit);
    if (mode === "turn") unit.distance = ACTION_GAUGE;
    this.currentActor = unit;
    this.currentExtraTurn = mode === "extraTurn";
    this.usedThisTurn = [];
    const extraTurn = mode === "extraTurn";
    this.emit({ type: "turnStart", unit, extraTurn, weight: 1 }, null);
    this.countdown(unit, "turnStart");
    if (unit.kind === "enemy") {
      this.enemyTurn(unit as EnemyUnit);
    } else if (unit === this.aha) {
      this.ahaInstant();
    } else {
      this.allyTurn(unit, mode);
    }
    this.processQueue();
    this.emit({ type: "turnEnd", unit, extraTurn, weight: 1 }, null);
    this.countdown(unit, "turnEnd");
    // Actions queued at turn end (counters, follow-ups) resolve now.
    this.processQueue();
    this.currentActor = null;
    this.currentExtraTurn = false;
  }

  private allyTurn(unit: CombatUnit, mode: "turn" | "extraTurn"): void {
    const behaviour = unit.behaviour;
    if (!behaviour) return;
    for (let step = 0; step < MAX_TURN_ABILITIES; step += 1) {
      const view = this.policyView(unit);
      const raw = behaviour.turnPolicy(view);
      const choice: TurnChoice =
        typeof raw === "string" ? { ability: raw } : raw;
      let ability = behaviour.abilities.get(choice.ability);
      if (!ability) {
        this.warnings.push(
          `unknown-ability:${unit.definitionId}:${choice.ability}`
        );
        return;
      }
      const cost = -(
        ability.skillPoints ??
        DEFAULT_SKILL_POINTS[ability.kind] ??
        0
      );
      const unusable = ability.usable !== undefined && !ability.usable(view);
      if (unusable || cost > this.skillPoints + 1e-9) {
        const fallback = behaviour.abilities.get("basic");
        if (fallback && fallback !== ability) ability = fallback;
      }
      const target =
        choice.target && choice.target.kind !== "enemy"
          ? (choice.target as CombatUnit)
          : ((choice.target as EnemyUnit | undefined) ?? this.mainTarget);
      this.execute(unit, ability, target, mode, 1);
      this.usedThisTurn.push(ability.id);
      if (ability.endsTurn !== false) return;
      // The turn continues: follow-ups and Ultimates may come first.
      this.processQueue();
      this.checkUltimates();
    }
    this.warnings.push(`turn-ability-limit:${unit.definitionId}`);
  }

  private enemyTurn(enemy: EnemyUnit): void {
    for (const status of [...enemy.statuses.values()]) {
      if (!status.def.dot || status.stacks <= 0) continue;
      this.tickDot(enemy, status, 1, false);
    }
    if (enemy.broken) {
      enemy.broken = false;
      enemy.toughness = enemy.maxToughness;
    }
    // Control effects: a base-chance application skips in expectation.
    let acts = 1;
    for (const status of enemy.statuses.values()) {
      if (!status.def.skipsTurn || status.stacks <= 0) continue;
      acts *= 1 - Math.min(1, status.baseChance ?? 1);
    }
    if (acts <= 1e-6) return;
    this.enemyAttack(enemy, acts);
  }

  private enemyAttack(enemy: EnemyUnit, weight: number): void {
    const targets = this.allies.filter((ally) => ally.kind === "character");
    const aggro = targets.map((ally) => Math.max(0, ally.aggro));
    const total = aggro.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return;
    this.emit({ type: "enemyAttack", unit: enemy, weight }, null);
    targets.forEach((ally, index) => {
      const share = ((aggro[index] ?? 0) / total) * weight;
      if (share <= 0) return;
      this.gainEnergy(ally, this.options.enemyAttackEnergy * share, false);
      this.emit(
        { type: "hitByEnemy", unit: ally, target: enemy, weight: share },
        null
      );
    });
  }

  private countdown(unit: CombatUnit, phase: "turnStart" | "turnEnd"): void {
    if (phase === "turnEnd" && unit.kind === "enemy") {
      const enemy = unit as EnemyUnit;
      for (const [type, remaining] of [...enemy.implants]) {
        if (remaining === null) continue;
        if (remaining <= 1) {
          enemy.implants.delete(type);
          enemy.weaknesses.delete(type);
        } else {
          enemy.implants.set(type, remaining - 1);
        }
      }
    }
    if (phase === "turnEnd") {
      for (let index = unit.bangers.length - 1; index >= 0; index -= 1) {
        const banger = unit.bangers[index];
        if (!banger) continue;
        if (banger.skip) {
          banger.skip = false;
          continue;
        }
        banger.remaining -= 1;
        if (banger.remaining <= 0) unit.bangers.splice(index, 1);
      }
    }
    const expire = (holder: CombatUnit, status: StatusInstance) => {
      if (status.remaining === null) return;
      if (phase === "turnEnd" && status.skipNextTurnEnd) {
        status.skipNextTurnEnd = false;
        return;
      }
      status.remaining -= 1;
      if (status.remaining <= 0) this.removeStatusInstance(holder, status);
    };
    for (const status of [...unit.statuses.values()]) {
      const duration = status.def.duration;
      if (!duration || (duration.clock ?? "holder") !== "holder") continue;
      if ((duration.countdown ?? "turnEnd") === phase) expire(unit, status);
    }
    for (const holder of this.everyUnit()) {
      for (const status of [...holder.statuses.values()]) {
        const duration = status.def.duration;
        if (!duration || duration.clock !== "applier") continue;
        if (status.applier !== unit) continue;
        if ((duration.countdown ?? "turnEnd") === phase) expire(holder, status);
      }
    }
  }

  private everyUnit(): CombatUnit[] {
    return [...this.allies, ...this.summons, ...this.enemies];
  }

  // ---------------------------------------------------------------------
  // Ultimates and queued actions

  checkUltimates(): void {
    for (let pass = 0; pass < ULTIMATE_PASSES; pass += 1) {
      let cast = false;
      for (const unit of [...this.allies]) {
        const behaviour = unit.behaviour;
        if (!behaviour?.ultimatePolicy) continue;
        const view = this.policyView(unit);
        const decision = behaviour.ultimatePolicy(view);
        if (decision === false) continue;
        const choice: TurnChoice =
          decision === true
            ? { ability: "ultimate" }
            : typeof decision === "string"
              ? { ability: decision }
              : decision;
        const ultimate = behaviour.abilities.get(choice.ability);
        if (!ultimate) continue;
        if (
          !unit.inActionOrder &&
          unit.kind === "character" &&
          !ultimate.castOutsideActionOrder
        ) {
          // Characters outside the Action Order (channeling) cannot cast.
          continue;
        }
        if (ultimate.usable && !ultimate.usable(view)) continue;
        if (ultimate.resource) {
          const { counter, amount } = ultimate.resource;
          if (unit.counter(counter) + 1e-9 < amount) continue;
          unit.counters.set(counter, unit.counter(counter) - amount);
        } else {
          const cost = ultimate.energyCost ?? unit.maxEnergy;
          if (unit.energy + 1e-9 < cost) continue;
          unit.energy -= cost;
        }
        this.execute(
          unit,
          ultimate,
          (choice.target as CombatUnit | undefined) ?? this.mainTarget,
          "ultimate",
          1
        );
        this.processQueue();
        cast = true;
      }
      if (!cast) return;
    }
  }

  private processQueue(): void {
    let guard = 0;
    while (
      (this.queue.length > 0 || this.ahaExtraTurns.length > 0) &&
      guard < 64
    ) {
      if (this.queue.length === 0) {
        const punchline = this.ahaExtraTurns.shift();
        if (punchline !== undefined) this.ahaInstant(punchline);
        guard += 1;
        continue;
      }
      guard += 1;
      const next = this.queue.shift();
      if (!next) break;
      const ability = next.unit.behaviour?.abilities.get(next.abilityId);
      if (!ability) {
        this.warnings.push(
          `unknown-ability:${next.unit.definitionId}:${next.abilityId}`
        );
        continue;
      }
      this.execute(
        next.unit,
        ability,
        next.target ?? this.mainTarget,
        "queued",
        next.weight
      );
    }
  }

  // ---------------------------------------------------------------------
  // Ability execution

  execute(
    unit: CombatUnit,
    ability: AbilityDef,
    target: CombatUnit | null,
    mode: ActionRecord["mode"],
    weight: number
  ): void {
    const skillPoints =
      ability.skillPoints ?? DEFAULT_SKILL_POINTS[ability.kind] ?? 0;
    for (const listener of this.listeners) listener.firedInAction = 0;
    const outerTargets = this.targetsHit;
    const targetsHit = new Set<EnemyUnit>();
    this.targetsHit = targetsHit;
    this.changeSkillPoints(skillPoints * weight, unit);
    const tags = ability.onlyTags ?? [
      ...new Set([
        ...DEFAULT_ABILITY_TAGS[ability.kind],
        ...(ability.tags ?? []),
      ]),
    ];
    const context = this.actionContext(unit, ability, target, weight);
    const attack =
      ability.attack ??
      (typeof ability.hits === "function" || (ability.hits?.length ?? 0) > 0);
    const enemyTarget =
      target?.kind === "enemy" ? (target as EnemyUnit) : this.mainTarget;
    const abilityTarget = ability.target ?? (attack ? "enemy" : "none");
    this.emit(
      {
        type: "actionStart",
        unit,
        target: target ?? undefined,
        abilityId: ability.id,
        abilityKind: ability.kind,
        abilityTarget,
        tags,
        attack,
        weight,
      },
      unit
    );
    ability.before?.(context);
    const hits =
      typeof ability.hits === "function"
        ? ability.hits(context)
        : (ability.hits ?? []);
    hits.forEach((hit, index) => {
      this.resolveHit(unit, hit, {
        abilityId: ability.id,
        abilityKind: ability.kind,
        origin: ability.origin ?? originForKind(ability.kind),
        tags,
        mainTarget: enemyTarget,
        weight,
      });
      ability.afterHit?.(context, index);
    });
    ability.after?.(context);
    const energy = ability.energy ?? DEFAULT_ENERGY[ability.kind] ?? 0;
    if (energy > 0) this.gainEnergy(unit, energy * weight, false);
    this.emit(
      {
        type: "actionEnd",
        unit,
        target: target ?? undefined,
        abilityId: ability.id,
        abilityKind: ability.kind,
        abilityTarget,
        tags,
        attack,
        targetsHit: [...targetsHit],
        weight,
      },
      unit
    );
    this.actions.push({
      time: this.time,
      cycle: this.cycle,
      unitId: unit.id,
      abilityId: ability.id,
      abilityKind: ability.kind,
      mode,
      skillPointsAfter: this.skillPoints,
      energyAfter: unit.energy,
    });
    this.targetsHit = outerTargets;
  }

  /** Expands one HitDef over its target roles and records each instance. */
  resolveHit(
    attacker: CombatUnit,
    hit: HitDef,
    context: {
      abilityId: string;
      abilityKind: AbilityKind;
      origin: EffectOrigin;
      tags: readonly DamageTag[];
      mainTarget: EnemyUnit | null;
      weight: number;
      targets?: readonly EnemyUnit[];
    }
  ): void {
    const main = context.mainTarget ?? this.mainTarget;
    if (!main) return;
    const declared = hit.onlyTags ?? [...context.tags, ...(hit.tags ?? [])];
    // Elation DMG is always Elation DMG, whatever ability deals it.
    const tags = [
      ...new Set(
        hit.kind === "elation" ? [...declared, "elation" as const] : declared
      ),
    ];
    const placements = this.placements(hit, main, context.targets);
    for (const placement of placements) {
      this.recordHit(attacker, hit, {
        ...context,
        tags,
        target: placement.target,
        role: placement.role,
        multiplier: placement.multiplier,
        weight: context.weight * placement.weight,
        toughness: placement.toughness,
      });
    }
  }

  private placements(
    hit: HitDef,
    main: EnemyUnit,
    explicit?: readonly EnemyUnit[]
  ): {
    target: EnemyUnit;
    role: TargetRole;
    multiplier: number;
    weight: number;
    toughness: number;
  }[] {
    const enemies = explicit ?? this.enemies;
    const toughness = hit.toughness ?? {};
    if (hit.shape === "aoe") {
      return enemies.map((target) => ({
        target,
        role: target === main ? "main" : "each",
        multiplier:
          target === main
            ? (hit.main ?? hit.each ?? 0)
            : (hit.each ?? hit.main ?? 0),
        weight: 1,
        toughness:
          target === main
            ? (toughness.main ?? toughness.each ?? 0)
            : (toughness.each ?? toughness.main ?? 0),
      }));
    }
    if (hit.shape === "split") {
      return enemies.map((target) => ({
        target,
        role: target === main ? "main" : "each",
        multiplier: (hit.main ?? hit.each ?? 0) / enemies.length,
        weight: 1,
        toughness: toughness.each ?? toughness.main ?? 0,
      }));
    }
    if (hit.shape === "bounce") {
      const count = hit.bounces ?? 1;
      return enemies.map((target) => ({
        target,
        role: "each",
        multiplier: hit.each ?? hit.main ?? 0,
        weight: count / enemies.length,
        toughness: toughness.each ?? 0,
      }));
    }
    const result = [
      {
        target: main,
        role: "main" as TargetRole,
        multiplier: hit.main ?? 0,
        weight: 1,
        toughness: toughness.main ?? 0,
      },
    ];
    if (hit.shape === "blast") {
      const index = this.enemies.indexOf(main);
      for (const neighbour of [
        this.enemies[index - 1],
        this.enemies[index + 1],
      ]) {
        if (!neighbour) continue;
        result.push({
          target: neighbour,
          role: "adjacent",
          multiplier: hit.adjacent ?? 0,
          weight: 1,
          toughness: toughness.adjacent ?? 0,
        });
      }
    }
    return result;
  }

  private recordHit(
    attacker: CombatUnit,
    hit: HitDef,
    context: {
      abilityId: string;
      abilityKind: AbilityKind;
      origin: EffectOrigin;
      tags: readonly DamageTag[];
      target: EnemyUnit;
      role: TargetRole;
      multiplier: number;
      weight: number;
      toughness: number;
    }
  ): void {
    const statUnit = attacker.statUnit;
    const scalingUnit =
      hit.statOwner === "owner" && attacker.owner ? attacker.owner : statUnit;
    const combatType = hit.combatType ?? attacker.combatType;
    const kind = hit.kind ?? "direct";
    const broken = context.target.broken;
    if (context.multiplier !== 0 || context.toughness > 0) {
      this.targetsHit?.add(context.target);
    }
    if (context.multiplier !== 0 || kind === "fixed") {
      this.hits.push({
        time: this.time,
        cycle: this.cycle,
        attackerId: attacker.id,
        statUnitId: statUnit.id,
        scalingUnitId: scalingUnit.id,
        abilityId: context.abilityId,
        abilityKind: context.abilityKind,
        origin: context.origin,
        hit,
        role: context.role,
        multiplier: context.multiplier,
        tags: context.tags,
        kind,
        combatType,
        targetId: context.target.id,
        weight: context.weight,
        attackerModifiers: this.outgoingSnapshot(statUnit),
        ...(scalingUnit === statUnit
          ? {}
          : { scalingModifiers: this.outgoingSnapshot(scalingUnit) }),
        targetModifiers: context.target.statusModifiers("incoming"),
        targetBroken: broken,
        ...targetSnapshot(context.target),
        punchline: hit.punchline ?? this.teamResources.get("punchline") ?? 0,
      });
    }
    if (context.toughness > 0) {
      this.applyToughness(
        statUnit,
        context.target,
        context.toughness,
        combatType,
        {
          abilityId: context.abilityId,
          abilityKind: context.abilityKind,
          origin: context.origin,
          tags: context.tags,
          weight: context.weight,
          hit,
          withoutWeakness: hit.toughnessWithoutWeakness ?? 0,
          fixed: false,
        }
      );
    }
    if (hit.silent || context.multiplier === 0) return;
    this.emit(
      {
        type: "hit",
        unit: attacker,
        target: context.target,
        abilityId: context.abilityId,
        abilityKind: context.abilityKind,
        tags: context.tags,
        attack: true,
        weight: context.weight,
      },
      attacker
    );
  }

  /**
   * Statuses on the stat unit. Memosprites inherit their owner's panel but
   * not its combat statuses; kits route buffs to them explicitly.
   */
  private outgoingSnapshot(unit: CombatUnit) {
    return unit.statusModifiers("outgoing");
  }

  private applyToughness(
    breaker: CombatUnit,
    enemy: EnemyUnit,
    amount: number,
    combatType: CombatType,
    context: {
      abilityId: string;
      abilityKind: AbilityKind;
      origin: EffectOrigin;
      tags: readonly DamageTag[];
      weight: number;
      hit: HitDef;
      withoutWeakness: number;
      fixed: boolean;
    }
  ): void {
    const matches = enemy.weaknesses.has(combatType);
    const scale = matches ? 1 : context.withoutWeakness;
    if (scale <= 0) return;
    const efficiency = context.fixed
      ? 0
      : this.momentaryStat(breaker, "breakEfficiency");
    const reduced = amount * scale * (1 + efficiency) * context.weight;
    const base = {
      time: this.time,
      cycle: this.cycle,
      attackerId: breaker.id,
      statUnitId: breaker.id,
      scalingUnitId: breaker.id,
      abilityId: context.abilityId,
      abilityKind: context.abilityKind,
      origin: context.origin,
      hit: context.hit,
      role: "main" as TargetRole,
      multiplier: 1,
      combatType,
      targetId: enemy.id,
      attackerModifiers: this.outgoingSnapshot(breaker),
      targetModifiers: enemy.statusModifiers("incoming"),
      ...targetSnapshot(enemy),
    };
    if (enemy.broken) {
      this.hits.push({
        ...base,
        tags: ["break", "superBreak", ...context.tags],
        kind: "superBreak",
        weight: 1,
        targetBroken: true,
        toughnessReduced: reduced,
      });
      return;
    }
    enemy.toughness -= reduced;
    if (enemy.toughness > 1e-9) return;
    enemy.toughness = 0;
    enemy.broken = true;
    // Break DMG resolves before the Weakness Broken state applies (×0.9).
    this.hits.push({
      ...base,
      tags: ["break"],
      kind: "break",
      weight: 1,
      targetBroken: false,
      maxToughness: enemy.maxToughness,
    });
    const effect = breakEffectFor(combatType);
    enemy.distance += ACTION_GAUGE * 0.25;
    const breakEffectValue = this.momentaryStat(breaker, "breakEffect");
    if (effect === "entanglement") {
      enemy.distance += ACTION_GAUGE * 0.2 * (1 + breakEffectValue);
    } else if (effect === "imprisonment") {
      enemy.distance += ACTION_GAUGE * 0.3 * (1 + breakEffectValue);
    }
    this.applyStatusInternal(enemy, BREAK_EFFECT_STATUS[effect], breaker, {
      stacks: 1,
    });
    this.emit(
      {
        type: "weaknessBreak",
        unit: breaker,
        target: enemy,
        abilityId: context.abilityId,
        abilityKind: context.abilityKind,
        weight: 1,
      },
      breaker
    );
  }

  private tickDot(
    enemy: EnemyUnit,
    status: StatusInstance,
    ratio: number,
    detonation: boolean
  ): void {
    const dot = status.def.dot;
    if (!dot) return;
    const applier = status.applier;
    const breakEffect = (Object.entries(BREAK_EFFECT_STATUS).find(
      ([, def]) => def === status.def
    )?.[0] ?? undefined) as BreakEffect | undefined;
    const kind = breakEffect ? "break" : (dot.hit.kind ?? "dot");
    const tags: DamageTag[] = breakEffect
      ? ["break", "dot"]
      : ["dot", ...(dot.hit.tags ?? [])];
    this.hits.push({
      time: this.time,
      cycle: this.cycle,
      attackerId: applier.id,
      statUnitId: applier.statUnit.id,
      scalingUnitId: applier.statUnit.id,
      abilityId: status.def.id,
      abilityKind: "other",
      origin: status.def.origin,
      hit: dot.hit,
      role: "main",
      multiplier: dot.hit.main ?? 0,
      tags,
      kind,
      combatType: dot.hit.combatType ?? applier.combatType,
      targetId: enemy.id,
      weight: ratio * status.stacks,
      ...(status.chance ? { chance: status.chance } : {}),
      attackerModifiers: this.outgoingSnapshot(applier.statUnit),
      targetModifiers: enemy.statusModifiers("incoming"),
      targetBroken: enemy.broken,
      ...targetSnapshot(enemy),
      maxToughness: enemy.maxToughness,
      breakEffect,
    });
    this.emit(
      {
        type: "dotTick",
        unit: enemy,
        target: enemy,
        status: status.def,
        detonation,
        weight: ratio,
      },
      null
    );
  }

  /** Stat value from panel and current unfiltered statuses (no scaling). */
  momentaryStat(unit: CombatUnit, stat: CombatStat): number {
    unit.statReads.add(stat);
    const vector = unit.panel.slice();
    for (const modifier of unit.statusModifiers("outgoing")) {
      if (modifier.def.stat !== stat || modifier.def.filter) continue;
      if (modifier.def.scaling) continue;
      combineStat(vector, stat, (modifier.def.value ?? 0) * modifier.scale);
    }
    for (const modifier of unit.conditional) {
      if (modifier.def.stat !== stat || modifier.def.filter) continue;
      if (modifier.def.scaling) continue;
      combineStat(vector, stat, (modifier.def.value ?? 0) * modifier.scale);
    }
    return readStat(vector, stat);
  }

  // ---------------------------------------------------------------------
  // Elation: Aha and the Aha Instant

  elationCharacters(): CombatUnit[] {
    return this.allies.filter(
      (ally) => ally.kind === "character" && ally.pathId === "Elation"
    );
  }

  /** Aha SPD = 80 + S1/5 + S2/10 + S3/20 + S4/40 over Elation allies' SPD. */
  ahaSpeed(): number {
    const speeds = this.elationCharacters()
      .map((ally) => ally.speed)
      .sort((left, right) => right - left);
    return speeds.reduce(
      (total, speed, rank) => total + speed / (5 * 2 ** Math.min(rank, 3)),
      80
    );
  }

  /**
   * Aha's turn: every participant's Elation Skill, then Certified Bangers
   * worth the Punchline. An extra turn (`fixedPunchline`) counts that fixed
   * amount instead and leaves the team's Punchline untouched.
   */
  private ahaInstant(fixedPunchline?: number): void {
    const aha = this.aha;
    if (!aha) return;
    const held = this.teamResources.get("punchline") ?? 0;
    const extraTurn = fixedPunchline !== undefined;
    const punchline = fixedPunchline ?? held;
    if (extraTurn) this.teamResources.set("punchline", punchline);
    const participants = this.allies.filter((ally) =>
      ally.behaviour?.abilities.has("elationSkill")
    );
    this.emit(
      { type: "ahaInstantStart", unit: aha, extraTurn, weight: 1 },
      null
    );
    for (const unit of participants) {
      const ability = unit.behaviour?.abilities.get("elationSkill");
      if (ability) this.execute(unit, ability, this.mainTarget, "queued", 1);
      this.processQueue();
    }
    if (punchline > 0) {
      for (const unit of participants) {
        if (unit.kind === "character") {
          unit.bangers.push({ value: punchline, remaining: 2, skip: false });
        }
      }
    }
    this.teamResources.set("punchline", extraTurn ? held : 0);
    this.emit({ type: "ahaInstantEnd", unit: aha, extraTurn, weight: 1 }, null);
    if (extraTurn) return;
    const regained =
      this.options.punchlinePerElationCharacter *
      this.elationCharacters().length;
    if (regained > 0)
      this.changeTeamResource(aha, "punchline", regained, undefined, 1, null);
  }

  changeTeamResource(
    unit: CombatUnit,
    name: string,
    delta: number,
    max: number | undefined,
    weight: number,
    actor: CombatUnit | null
  ): void {
    const next = (this.teamResources.get(name) ?? 0) + delta * weight;
    const value = Math.max(0, max === undefined ? next : Math.min(max, next));
    this.teamResources.set(name, value);
    if (
      name === "punchline" &&
      value > 0 &&
      this.aha &&
      !this.aha.inActionOrder
    ) {
      this.aha.inActionOrder = true;
      this.aha.distance = ACTION_GAUGE;
    }
    this.emit(
      {
        type: "teamResourceChanged",
        unit,
        resource: name,
        delta: delta * weight,
        weight,
      },
      actor
    );
  }

  // ---------------------------------------------------------------------
  // Resources

  /** Returns the Energy lost to the cap (overflow), after ERR. */
  gainEnergy(unit: CombatUnit, amount: number, fixed: boolean): number {
    // Summons and memosprites have no Energy bar; it goes to the owner.
    const target = unit.kind !== "character" && unit.owner ? unit.owner : unit;
    if (target.kind !== "character") return 0;
    const scale = fixed ? 1 : 1 + this.momentaryStat(target, "energyRegen");
    const next = target.energy + amount * scale;
    target.energy = Math.min(target.maxEnergy, next);
    return Math.max(0, next - target.maxEnergy);
  }

  /** Clamp Skill Points to [0, cap] and report the actual change. */
  changeSkillPoints(delta: number, actor: CombatUnit | null): void {
    const before = this.skillPoints;
    this.skillPoints = Math.min(
      this.maxSkillPoints,
      Math.max(0, this.skillPoints + delta)
    );
    const change = this.skillPoints - before;
    if (Math.abs(change) < 1e-12) return;
    this.emit(
      {
        type: "skillPointsChanged",
        unit: actor ?? this.allies[0] ?? this.enemies[0]!,
        delta: change,
        weight: 1,
      },
      actor
    );
  }

  // ---------------------------------------------------------------------
  // Statuses

  applyStatusInternal(
    holder: CombatUnit,
    def: StatusDef,
    applier: CombatUnit,
    options: ApplyStatusOptions
  ): void {
    const baseChance =
      holder.kind === "enemy" && options.baseChance !== undefined
        ? options.baseChance
        : null;
    if (baseChance !== null && baseChance <= 0) return;
    const key = holder.statusKey(def, applier);
    const existing = holder.statuses.get(key);
    const clockUnit =
      (def.duration?.clock ?? "holder") === "holder" ? holder : applier;
    const duringOwnTurn = this.currentActor === clockUnit;
    if (existing) {
      existing.refresh(options);
      if (existing.baseChance !== null) {
        existing.baseChance =
          baseChance === null
            ? null
            : Math.max(existing.baseChance, baseChance);
      }
      existing.skipNextTurnEnd = duringOwnTurn;
    } else {
      const source = this.statusSources.get(def) ?? {
        type: "engine",
        id: def.id,
        providerId: applier.id,
      };
      const instance = new StatusInstance(
        def,
        holder,
        applier,
        source,
        options,
        baseChance
      );
      instance.skipNextTurnEnd = duringOwnTurn;
      holder.statuses.set(key, instance);
    }
    this.emit(
      {
        type: "statusApplied",
        unit: applier,
        target: holder,
        status: def,
        weight: 1,
      },
      applier
    );
  }

  // ---------------------------------------------------------------------
  // Events

  emit(event: BattleEvent, actor: CombatUnit | null): void {
    for (const listener of [...this.listeners]) {
      if (listener.def.event !== event.type) continue;
      if (!this.matches(listener, event)) continue;
      // Limits count expected firings; the last one is scaled to what is
      // left, so a 30% trigger before a sure one still totals one firing.
      const { limitPerTurn, limitPerAction, limitPerOwnTurn } =
        listener.def.filter;
      let weight = event.weight;
      if (limitPerTurn !== undefined)
        weight = Math.min(weight, limitPerTurn - listener.fired);
      if (limitPerAction !== undefined)
        weight = Math.min(weight, limitPerAction - listener.firedInAction);
      if (limitPerOwnTurn !== undefined)
        weight = Math.min(weight, limitPerOwnTurn - listener.firedInOwnTurn);
      if (weight <= 1e-9) continue;
      const api = this.api(listener.owner, weight, actor);
      const scaled = weight === event.weight ? event : { ...event, weight };
      listener.def.handler(api, scaled);
      listener.fired += weight;
      listener.firedInAction += weight;
      listener.firedInOwnTurn += weight;
    }
  }

  private matches(listener: RegisteredListener, event: BattleEvent): boolean {
    const filter: EventFilter = listener.def.filter;
    const owner = listener.owner;
    const unit = event.unit as CombatUnit;
    switch (filter.subject ?? "self") {
      case "self":
        // A summon's attacks are its owner's (Lightning-Lord, Numby).
        if (
          unit !== owner &&
          !(unit.kind === "summon" && unit.owner === owner && event.attack)
        ) {
          return false;
        }
        break;
      case "selfOrMemosprite":
        if (unit !== owner && unit.owner !== owner) return false;
        break;
      case "memosprite":
        if (unit.kind !== "memosprite" || unit.owner !== owner) return false;
        break;
      case "ally":
        if (unit.kind === "enemy") return false;
        break;
      case "otherAlly":
        if (unit.kind === "enemy" || unit === owner) return false;
        break;
      case "enemy":
        if (unit.kind !== "enemy") return false;
        break;
      case "any":
        break;
    }
    if (
      filter.abilityKinds &&
      !filter.abilityKinds.includes(event.abilityKind ?? "other")
    ) {
      return false;
    }
    if (filter.tags && !filter.tags.some((tag) => event.tags?.includes(tag))) {
      return false;
    }
    if (
      filter.attack !== undefined &&
      filter.attack !== (event.attack ?? false)
    ) {
      return false;
    }
    if (filter.status && filter.status !== event.status) return false;
    if (filter.resource && filter.resource !== event.resource) return false;
    if (filter.when && !filter.when(event, owner)) return false;
    return true;
  }

  private resetTurnLimits(unit: CombatUnit): void {
    for (const listener of this.listeners) {
      listener.fired = 0;
      if (listener.owner === unit) listener.firedInOwnTurn = 0;
    }
  }

  // ---------------------------------------------------------------------
  // Kit-facing API

  policyView(unit: CombatUnit): PolicyView {
    return {
      self: unit,
      allies: this.allies,
      enemies: this.enemies,
      skillPoints: this.skillPoints,
      maxSkillPoints: this.maxSkillPoints,
      cycle: this.cycle,
      time: this.time,
      mainTarget: this.mainTarget,
      upcoming: this.upcoming,
      extraTurn: this.currentActor === unit && this.currentExtraTurn,
      usedThisTurn: this.currentActor === unit ? [...this.usedThisTurn] : [],
      teamResource: (name) => this.teamResources.get(name) ?? 0,
    };
  }

  private actionContext(
    unit: CombatUnit,
    ability: AbilityDef,
    target: CombatUnit | null,
    weight: number
  ): ActionContext {
    const api = this.api(unit, weight, unit, {
      abilityId: ability.id,
      abilityKind: ability.kind,
      origin: ability.origin ?? originForKind(ability.kind),
    });
    const targetsHit = this.targetsHit;
    // Assign onto the API object so its live getters (Skill Points, time)
    // keep reading the battle instead of a copy taken at action start.
    return Object.assign(api, {
      abilityId: ability.id,
      abilityKind: ability.kind,
      target,
      scratch: new Map<string, unknown>(),
      targetsHit: (): readonly EnemyView[] => [...(targetsHit ?? [])],
    });
  }

  api(
    self: CombatUnit,
    weight: number,
    actor: CombatUnit | null,
    dealDefaults?: DealDefaults
  ): BattleApi {
    const battle = this;
    const asUnit = (view: UnitView) => view as CombatUnit;
    return {
      self,
      allies: this.allies,
      enemies: this.enemies,
      get skillPoints() {
        return battle.skillPoints;
      },
      get maxSkillPoints() {
        return battle.maxSkillPoints;
      },
      get cycle() {
        return battle.cycle;
      },
      get time() {
        return battle.time;
      },
      get mainTarget() {
        return battle.mainTarget;
      },
      weight,
      applyStatus: (target, status, options = {}) =>
        battle.applyStatusInternal(asUnit(target), status, self, options),
      removeStatus: (target, status) => {
        const unit = asUnit(target);
        for (const instance of [...unit.statuses.values()]) {
          if (instance.def === status)
            battle.removeStatusInstance(unit, instance);
        }
      },
      setStatusStacks: (target, status, stacks) => {
        const unit = asUnit(target);
        const instance = unit.findStatus(status);
        if (!instance) return;
        const max = status.maxStacks ?? 1;
        instance.stacks = Math.min(max, Math.max(0, stacks));
        if (instance.stacks <= 0) battle.removeStatusInstance(unit, instance);
      },
      consumeStacks: (target, status, stacks) => {
        const unit = asUnit(target);
        const instance = unit.findStatus(status);
        if (!instance) return;
        instance.stacks = Math.max(0, instance.stacks - stacks);
        if (instance.stacks <= 0) battle.removeStatusInstance(unit, instance);
      },
      extendStatus: (target, status, turns) => {
        for (const instance of asUnit(target).statuses.values()) {
          if (instance.def === status && instance.remaining !== null)
            instance.remaining += turns;
        }
      },
      gainEnergy: (unit, amount, options) =>
        battle.gainEnergy(
          asUnit(unit),
          amount * weight,
          options?.fixed ?? false
        ),
      setEnergy: (unit, amount) => {
        asUnit(unit).energy = Math.min(asUnit(unit).maxEnergy, amount);
      },
      gainSkillPoints: (amount) =>
        battle.changeSkillPoints(amount * weight, actor ?? self),
      setMaxSkillPoints: (max) => {
        battle.maxSkillPoints = Math.max(0, max);
        battle.skillPoints = Math.min(
          battle.skillPoints,
          battle.maxSkillPoints
        );
      },
      advanceAction: (unit, fraction) => {
        const target = asUnit(unit);
        target.distance = Math.max(
          0,
          target.distance - ACTION_GAUGE * fraction * weight
        );
      },
      delayAction: (unit, fraction) => {
        asUnit(unit).distance += ACTION_GAUGE * fraction * weight;
      },
      grantExtraTurn: (unit) => {
        const target = asUnit(unit);
        target.pendingExtraTurns += weight;
        if (target.pendingExtraTurns >= 1 - 1e-6) {
          target.pendingExtraTurns -= 1;
          battle.extraTurns.push(target);
        }
      },
      setInActionOrder: (unit, inOrder) => {
        const target = asUnit(unit);
        target.inActionOrder = inOrder;
        if (inOrder) target.distance = Math.min(target.distance, ACTION_GAUGE);
      },
      queueAction: (unit, abilityId, options = {}) => {
        battle.queue.push({
          unit: asUnit(unit),
          abilityId,
          target: (options.target as EnemyUnit | undefined) ?? null,
          weight: (options.weight ?? 1) * weight,
        });
      },
      deal: (hit, options: DealOptions = {}) => {
        const attacker = options.attacker ? asUnit(options.attacker) : self;
        const origin = options.origin ?? dealDefaults?.origin ?? "talent";
        battle.resolveHit(attacker, hit, {
          abilityId:
            options.abilityId ??
            (options.origin === undefined ? dealDefaults?.abilityId : null) ??
            `${origin}:${self.definitionId}`,
          abilityKind:
            options.abilityKind ?? dealDefaults?.abilityKind ?? "other",
          origin,
          tags: options.tags ?? [],
          mainTarget:
            (options.targets?.[0] as EnemyUnit | undefined) ??
            battle.mainTarget,
          weight: weight * (options.weight ?? 1),
          targets: options.targets as EnemyUnit[] | undefined,
        });
      },
      detonateDots: (target, ratio, options = {}) => {
        const enemy = target as EnemyUnit;
        for (const status of [...enemy.statuses.values()]) {
          if (!status.def.dot || status.stacks <= 0) continue;
          if (options.filter && !options.filter(status.def)) continue;
          battle.tickDot(enemy, status, ratio * weight, true);
        }
      },
      reduceToughness: (target, amount, options: ToughnessOptions = {}) => {
        const origin = options.origin ?? dealDefaults?.origin ?? "talent";
        battle.applyToughness(
          self.statUnit,
          target as EnemyUnit,
          amount,
          options.combatType ?? self.combatType,
          {
            abilityId:
              options.abilityId ??
              dealDefaults?.abilityId ??
              `${origin}:${self.definitionId}`,
            abilityKind: dealDefaults?.abilityKind ?? "other",
            origin,
            tags: [],
            weight,
            hit: { shape: "single" },
            withoutWeakness: options.withoutWeakness ?? 0,
            fixed: options.fixed ?? false,
          }
        );
      },
      implantWeakness: (target, combatType, options = {}) => {
        const enemy = target as EnemyUnit;
        const native =
          enemy.weaknesses.has(combatType) && !enemy.implants.has(combatType);
        if (native) return;
        enemy.weaknesses.add(combatType);
        enemy.implants.set(combatType, options.turns ?? null);
      },
      removeWeakness: (target, combatType) => {
        const enemy = target as EnemyUnit;
        enemy.weaknesses.delete(combatType);
        enemy.implants.delete(combatType);
      },
      addCounter: (unit, name, delta, max) => {
        const target = asUnit(unit);
        const next = (target.counters.get(name) ?? 0) + delta * weight;
        target.counters.set(
          name,
          max === undefined ? next : Math.min(max, next)
        );
      },
      setCounter: (unit, name, value) => {
        asUnit(unit).counters.set(name, value);
      },
      teamResource: (name) => battle.teamResources.get(name) ?? 0,
      addTeamResource: (name, delta, max) =>
        battle.changeTeamResource(self, name, delta, max, weight, actor),
      summon: (owner, servantId) => battle.summon(asUnit(owner), servantId),
      findSummon: (owner, servantId) =>
        [...battle.allies, ...battle.summons].find(
          (unit) => unit.owner === owner && unit.definitionId === servantId
        ) ?? null,
      ahaExtraTurn: (punchline) => {
        if (battle.aha) battle.ahaExtraTurns.push(punchline);
      },
      grantCertifiedBanger: (unit, value, turns = 2) => {
        const target = asUnit(unit);
        target.bangers.push({
          value: value * weight,
          remaining: turns,
          skip: battle.currentTurnUnit() === target,
        });
      },
      dismiss: (unit) => {
        const target = asUnit(unit);
        target.inActionOrder = false;
        const summonIndex = battle.summons.indexOf(target);
        if (summonIndex >= 0) battle.summons.splice(summonIndex, 1);
        const allyIndex = battle.allies.indexOf(target);
        if (allyIndex >= 0 && target.kind !== "character") {
          battle.allies.splice(allyIndex, 1);
        }
        if (target.kind !== "character") {
          battle.retired.push(target);
          battle.emit({ type: "departed", unit: target, weight: 1 }, target);
        }
      },
    };
  }

  /** Removes a status and reports it (expiry, removal, or no stacks left). */
  removeStatusInstance(holder: CombatUnit, instance: StatusInstance): void {
    const key = holder.statusKey(instance.def, instance.applier);
    if (holder.statuses.get(key) !== instance) return;
    holder.statuses.delete(key);
    this.emit(
      {
        type: "statusRemoved",
        unit: instance.applier,
        target: holder,
        status: instance.def,
        weight: 1,
      },
      instance.applier
    );
  }

  summon(owner: CombatUnit, servantId: string): CombatUnit {
    const existing = [...this.allies, ...this.summons].find(
      (unit) => unit.owner === owner && unit.definitionId === servantId
    );
    if (existing) {
      // Re-summoning restarts a countdown and returns a memosprite to the field.
      existing.inActionOrder = true;
      existing.distance = ACTION_GAUGE;
      return existing;
    }
    const factory = this.servantFactories.get(`${owner.id}:${servantId}`);
    if (!factory) {
      throw new Error(`No summon ${servantId} for ${owner.definitionId}`);
    }
    const unit = factory(owner);
    const retiredIndex = this.retired.findIndex(
      (entry) => entry.id === unit.id
    );
    if (retiredIndex >= 0) this.retired.splice(retiredIndex, 1);
    this.onUnitCreated?.(unit);
    if (unit.kind === "memosprite") this.allies.push(unit);
    else this.summons.push(unit);
    this.emit({ type: "summoned", unit, weight: 1 }, unit);
    return unit;
  }
}

function originForKind(kind: AbilityKind): EffectOrigin {
  switch (kind) {
    case "basic":
      return "basic";
    case "skill":
      return "skill";
    case "ultimate":
      return "ultimate";
    case "memospriteSkill":
      return "memospriteSkill";
    case "elationSkill":
      return "elationSkill";
    default:
      return "talent";
  }
}

/** Target state captured at a hit, for target-state hit filters. */
function targetSnapshot(enemy: EnemyUnit) {
  return {
    targetWeaknesses: [...enemy.weaknesses],
    targetStatuses: enemy.statusSignature(),
    targetDebuffs: enemy.debuffCount(),
  };
}
