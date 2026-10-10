import type {
  AbilityDef,
  ActionContext,
  ApplyStatusOptions,
  BattleApi,
  BattleEvent,
  DealOptions,
  EventFilter,
  PolicyView,
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
import type { DamageTag } from "../model/tags";
import { BREAK_EFFECT_STATUS, breakEffectFor } from "./breakEffects";
import type {
  ActionRecord,
  BreakEffect,
  CombatLog,
  HitRecord,
  TargetRole,
} from "./log";
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
  fired: number;
  firedInAction: number;
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
  private readonly queue: QueuedAction[] = [];
  private readonly extraTurns: CombatUnit[] = [];
  private actionCount = 0;
  private currentActor: CombatUnit | null = null;
  private readonly endTime: number;

  constructor(
    characters: readonly CombatUnit[],
    enemies: readonly EnemyUnit[],
    readonly options: BattleOptions
  ) {
    this.allies.push(...characters);
    this.enemies = [...enemies];
    this.skillPoints = options.startingSkillPoints;
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
    this.listeners.push({ owner, def, source, fired: 0, firedInAction: 0 });
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
      this.checkUltimates();
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
    this.resetTurnLimits();
    if (mode === "turn") unit.distance = ACTION_GAUGE;
    this.currentActor = unit;
    this.emit({ type: "turnStart", unit, weight: 1 }, null);
    this.countdown(unit, "turnStart");
    if (unit.kind === "enemy") {
      this.enemyTurn(unit as EnemyUnit);
    } else if (unit === this.aha) {
      this.ahaInstant();
    } else {
      this.allyTurn(unit, mode);
    }
    this.processQueue();
    this.emit({ type: "turnEnd", unit, weight: 1 }, null);
    this.countdown(unit, "turnEnd");
    this.currentActor = null;
  }

  private allyTurn(unit: CombatUnit, mode: "turn" | "extraTurn"): void {
    const behaviour = unit.behaviour;
    if (!behaviour) return;
    let abilityId = behaviour.turnPolicy(this.policyView(unit));
    let ability = behaviour.abilities.get(abilityId);
    if (!ability) {
      this.warnings.push(`unknown-ability:${unit.definitionId}:${abilityId}`);
      return;
    }
    const cost = -(
      ability.skillPoints ??
      DEFAULT_SKILL_POINTS[ability.kind] ??
      0
    );
    if (cost > this.skillPoints + 1e-9) {
      const fallback = behaviour.abilities.get("basic");
      if (fallback && fallback !== ability) {
        abilityId = "basic";
        ability = fallback;
      }
    }
    this.execute(unit, ability, this.mainTarget, mode, 1);
  }

  private enemyTurn(enemy: EnemyUnit): void {
    for (const status of [...enemy.statuses.values()]) {
      if (!status.def.dot || status.stacks <= 0) continue;
      this.tickDot(enemy, status, 1);
    }
    if (enemy.broken) {
      enemy.broken = false;
      enemy.toughness = enemy.maxToughness;
    }
    const frozen = enemy.findStatus(BREAK_EFFECT_STATUS.frozen);
    if (frozen && frozen.stacks > 0) return;
    this.enemyAttack(enemy);
  }

  private enemyAttack(enemy: EnemyUnit): void {
    const targets = this.allies.filter((ally) => ally.kind === "character");
    const aggro = targets.map((ally) => Math.max(0, ally.aggro));
    const total = aggro.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return;
    this.emit({ type: "enemyAttack", unit: enemy, weight: 1 }, null);
    targets.forEach((ally, index) => {
      const share = (aggro[index] ?? 0) / total;
      if (share <= 0) return;
      this.gainEnergy(ally, this.options.enemyAttackEnergy * share, false);
      this.emit(
        { type: "hitByEnemy", unit: ally, target: enemy, weight: share },
        null
      );
    });
  }

  private countdown(unit: CombatUnit, phase: "turnStart" | "turnEnd"): void {
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
      if (status.remaining <= 0) {
        holder.statuses.delete(holder.statusKey(status.def, status.applier));
      }
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
      for (const unit of this.allies) {
        const behaviour = unit.behaviour;
        const ultimate = behaviour?.abilities.get("ultimate");
        if (!behaviour?.ultimatePolicy || !ultimate) continue;
        if (!unit.inActionOrder && unit.kind === "character") {
          // Characters outside the Action Order (channeling) cannot cast.
          continue;
        }
        const cost = ultimate.energyCost ?? unit.maxEnergy;
        if (unit.energy + 1e-9 < cost) continue;
        const view = this.policyView(unit);
        if (ultimate.usable && !ultimate.usable(view)) continue;
        if (!behaviour.ultimatePolicy(view)) continue;
        unit.energy -= cost;
        this.execute(unit, ultimate, this.mainTarget, "ultimate", 1);
        this.processQueue();
        cast = true;
      }
      if (!cast) return;
    }
  }

  private processQueue(): void {
    let guard = 0;
    while (this.queue.length > 0 && guard < 64) {
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
    target: EnemyUnit | null,
    mode: ActionRecord["mode"],
    weight: number
  ): void {
    const skillPoints =
      ability.skillPoints ?? DEFAULT_SKILL_POINTS[ability.kind] ?? 0;
    this.skillPoints = Math.min(
      this.options.maxSkillPoints,
      Math.max(0, this.skillPoints + skillPoints * weight)
    );
    for (const listener of this.listeners) listener.firedInAction = 0;
    const tags = ability.tags ?? DEFAULT_ABILITY_TAGS[ability.kind];
    const context = this.actionContext(unit, ability, target, weight);
    const attack = (ability.hits?.length ?? 0) > 0;
    this.emit(
      {
        type: "actionStart",
        unit,
        target: target ?? undefined,
        abilityId: ability.id,
        abilityKind: ability.kind,
        tags,
        attack,
        weight,
      },
      unit
    );
    ability.before?.(context);
    for (const hit of ability.hits ?? []) {
      this.resolveHit(unit, hit, {
        abilityId: ability.id,
        abilityKind: ability.kind,
        origin: ability.origin ?? originForKind(ability.kind),
        tags,
        mainTarget: target,
        weight,
      });
    }
    ability.after?.(context);
    const energy = ability.energy ?? DEFAULT_ENERGY[ability.kind] ?? 0;
    if (energy > 0) this.gainEnergy(unit, energy * weight, false);
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
    this.emit(
      {
        type: "actionEnd",
        unit,
        target: target ?? undefined,
        abilityId: ability.id,
        abilityKind: ability.kind,
        tags,
        attack,
        weight,
      },
      unit
    );
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
    const tags = hit.onlyTags ?? [
      ...new Set([...context.tags, ...(hit.tags ?? [])]),
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
        multiplier: hit.each ?? hit.main ?? 0,
        weight: 1,
        toughness:
          target === main
            ? (toughness.main ?? toughness.each ?? 0)
            : (toughness.each ?? toughness.main ?? 0),
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
        targetModifiers: context.target.statusModifiers("incoming"),
        targetBroken: broken,
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
        }
      );
    }
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
    }
  ): void {
    if (!enemy.weaknesses.has(combatType)) return;
    const efficiency = this.momentaryStat(breaker, "breakEfficiency");
    const reduced = amount * (1 + efficiency) * context.weight;
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
    ratio: number
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
      maxToughness: enemy.maxToughness,
      breakEffect,
    });
    this.emit(
      {
        type: "dotTick",
        unit: enemy,
        target: enemy,
        status: status.def,
        weight: ratio,
      },
      null
    );
  }

  /** Stat value from panel and current unfiltered statuses (no scaling). */
  momentaryStat(unit: CombatUnit, stat: CombatStat): number {
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

  private ahaInstant(): void {
    const punchline = this.teamResources.get("punchline") ?? 0;
    const participants = this.allies.filter((ally) =>
      ally.behaviour?.abilities.has("elationSkill")
    );
    const aha = this.aha;
    if (!aha) return;
    this.emit({ type: "ahaInstantStart", unit: aha, weight: 1 }, null);
    for (const unit of participants) {
      const ability = unit.behaviour?.abilities.get("elationSkill");
      if (ability) this.execute(unit, ability, this.mainTarget, "queued", 1);
      this.processQueue();
    }
    for (const unit of participants) {
      if (unit.kind === "character") {
        unit.bangers.push({ value: punchline, remaining: 2, skip: false });
      }
    }
    this.teamResources.set("punchline", 0);
    this.emit({ type: "ahaInstantEnd", unit: aha, weight: 1 }, null);
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

  gainEnergy(unit: CombatUnit, amount: number, fixed: boolean): void {
    // Summons and memosprites have no Energy bar; it goes to the owner.
    const target = unit.kind !== "character" && unit.owner ? unit.owner : unit;
    if (target.kind !== "character") return;
    const scale = fixed ? 1 : 1 + this.momentaryStat(target, "energyRegen");
    target.energy = Math.min(target.maxEnergy, target.energy + amount * scale);
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
    for (const listener of this.listeners) {
      if (listener.def.event !== event.type) continue;
      if (!this.matches(listener, event)) continue;
      const { limitPerTurn, limitPerAction } = listener.def.filter;
      if (limitPerTurn !== undefined && listener.fired >= limitPerTurn)
        continue;
      if (
        limitPerAction !== undefined &&
        listener.firedInAction >= limitPerAction
      ) {
        continue;
      }
      listener.fired += 1;
      listener.firedInAction += 1;
      const api = this.api(listener.owner, event.weight, actor);
      listener.def.handler(api, event);
    }
  }

  private matches(listener: RegisteredListener, event: BattleEvent): boolean {
    const filter: EventFilter = listener.def.filter;
    const owner = listener.owner;
    const unit = event.unit as CombatUnit;
    switch (filter.subject ?? "self") {
      case "self":
        if (unit !== owner) return false;
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
    return true;
  }

  private resetTurnLimits(): void {
    for (const listener of this.listeners) listener.fired = 0;
  }

  // ---------------------------------------------------------------------
  // Kit-facing API

  policyView(unit: CombatUnit): PolicyView {
    return {
      self: unit,
      allies: this.allies,
      enemies: this.enemies,
      skillPoints: this.skillPoints,
      maxSkillPoints: this.options.maxSkillPoints,
      cycle: this.cycle,
      time: this.time,
      teamResource: (name) => this.teamResources.get(name) ?? 0,
    };
  }

  private actionContext(
    unit: CombatUnit,
    ability: AbilityDef,
    target: EnemyUnit | null,
    weight: number
  ): ActionContext {
    return {
      ...this.api(unit, weight, unit),
      abilityId: ability.id,
      abilityKind: ability.kind,
      target,
    };
  }

  api(self: CombatUnit, weight: number, actor: CombatUnit | null): BattleApi {
    const battle = this;
    const asUnit = (view: UnitView) => view as CombatUnit;
    return {
      self,
      allies: this.allies,
      enemies: this.enemies,
      get skillPoints() {
        return battle.skillPoints;
      },
      get cycle() {
        return battle.cycle;
      },
      weight,
      applyStatus: (target, status, options = {}) =>
        battle.applyStatusInternal(asUnit(target), status, self, options),
      removeStatus: (target, status) => {
        const unit = asUnit(target);
        for (const [key, instance] of unit.statuses) {
          if (instance.def === status) unit.statuses.delete(key);
        }
      },
      consumeStacks: (target, status, stacks) => {
        const instance = asUnit(target).findStatus(status);
        if (!instance) return;
        instance.stacks = Math.max(0, instance.stacks - stacks);
        if (instance.stacks <= 0) {
          asUnit(target).statuses.delete(
            asUnit(target).statusKey(instance.def, instance.applier)
          );
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
      gainSkillPoints: (amount) => {
        battle.skillPoints = Math.min(
          battle.options.maxSkillPoints,
          Math.max(0, battle.skillPoints + amount * weight)
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
        if (weight >= 0.5) battle.extraTurns.push(asUnit(unit));
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
        battle.resolveHit(attacker, hit, {
          abilityId: `${options.origin ?? "talent"}:${self.definitionId}`,
          abilityKind: options.abilityKind ?? "other",
          origin: options.origin ?? "talent",
          tags: options.tags ?? [],
          mainTarget:
            (options.targets?.[0] as EnemyUnit | undefined) ??
            battle.mainTarget,
          weight,
          targets: options.targets as EnemyUnit[] | undefined,
        });
      },
      detonateDots: (target, ratio, options = {}) => {
        const enemy = target as EnemyUnit;
        for (const status of [...enemy.statuses.values()]) {
          if (!status.def.dot || status.stacks <= 0) continue;
          if (options.filter && !options.filter(status.def)) continue;
          battle.tickDot(enemy, status, ratio * weight);
        }
      },
      reduceToughness: (target, amount) => {
        battle.applyToughness(
          self.statUnit,
          target as EnemyUnit,
          amount,
          self.combatType,
          {
            abilityId: "toughness",
            abilityKind: "other",
            origin: "talent",
            tags: [],
            weight,
            hit: { shape: "single" },
          }
        );
      },
      implantWeakness: (target, combatType) => {
        (target as EnemyUnit).weaknesses.add(combatType);
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
        if (target.kind !== "character") battle.retired.push(target);
      },
    };
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
