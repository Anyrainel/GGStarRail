import type {
  AbilityDef,
  ApplyStatusOptions,
  EnemyView,
  TurnPolicy,
  UltimatePolicy,
  UnitView,
} from "../kit/api";
import type {
  EffectOrigin,
  ModifierDef,
  StatScaling,
  StatusDef,
} from "../kit/model";
import { scaledValue } from "../kit/scaling";
import {
  type CombatStat,
  type CombatType,
  combineStat,
  finalStat,
  INCOMING_STATS,
  readStat,
  type StatVector,
} from "../model/stats";
import {
  type HitDescriptor,
  modifierApplies,
  type StatusFamily,
  type UnitKind,
} from "../model/tags";

/** The catalog entity an effect belongs to, for breakdowns and ledgers. */
export interface EffectSource {
  type: "character" | "lightCone" | "relicSet" | "scenario" | "engine";
  id: string;
  /** Unit that owns the entity (its wearer or the Character itself). */
  providerId: string;
}

/** A modifier attached to a unit, ready for damage evaluation. */
export interface AppliedModifier {
  readonly uid: number;
  readonly def: ModifierDef;
  readonly origin: EffectOrigin;
  readonly source: EffectSource;
  /** Unit whose stats feed `def.scaling` with source `applier`. */
  readonly applierId: string;
  /** Stack count. */
  readonly scale: number;
  /**
   * Debuffs applied with a base chance land with an expected probability
   * resolved at evaluation from the applier's Effect Hit Rate, so the
   * timeline never depends on Effect Hit Rate.
   */
  readonly chance: DebuffChance | null;
}

export interface DebuffChance {
  readonly base: number;
  readonly applierId: string;
  /**
   * The applier's Effect Hit Rate from statuses and team auras when the
   * debuff was applied; its panel Effect Hit Rate is read at evaluation.
   */
  readonly bonus: number;
}

/**
 * Target state split by certainty, when some statuses on the target were
 * applied with a base chance: filters that only pass thanks to those are
 * scaled by their landing chances at evaluation.
 */
export interface TargetChances {
  /** Status IDs and `family:` entries of statuses that surely landed. */
  readonly certain: readonly string[];
  readonly certainDebuffs: number;
  readonly certainDots: number;
  readonly pending: readonly PendingStatus[];
}

export interface PendingStatus extends DebuffChance {
  readonly entries: readonly string[];
  readonly debuff: boolean;
  readonly dot: boolean;
}

let nextModifierUid = 1;

export function appliedModifier(
  def: ModifierDef,
  origin: EffectOrigin,
  source: EffectSource,
  applierId: string,
  scale: number,
  chance: DebuffChance | null = null
): AppliedModifier {
  nextModifierUid += 1;
  return {
    uid: nextModifierUid,
    def,
    origin,
    source,
    applierId,
    scale,
    chance,
  };
}

export class StatusInstance {
  stacks: number;
  remaining: number | null;
  /** Applied during the holder's own turn: that turn does not count down. */
  skipNextTurnEnd = false;
  private cached: readonly AppliedModifier[] | null = null;
  private cachedScale = Number.NaN;
  private cachedChance: number | null = null;
  private cachedBonus = 0;
  /** Applier's status Effect Hit Rate at application (see DebuffChance). */
  ehrBonus = 0;

  constructor(
    readonly def: StatusDef,
    readonly holder: CombatUnit,
    readonly applier: CombatUnit,
    readonly source: EffectSource,
    options: ApplyStatusOptions,
    /** Base chance of a debuff, or null when it always lands. */
    public baseChance: number | null
  ) {
    this.stacks = 0;
    this.remaining = null;
    this.refresh(options);
  }

  refresh(options: ApplyStatusOptions): void {
    const max = this.def.maxStacks ?? 1;
    if (options.setStacks !== undefined) {
      this.stacks = Math.min(max, Math.max(0, options.setStacks));
    } else {
      this.stacks = Math.min(max, this.stacks + (options.stacks ?? 1));
    }
    const turns = options.turns ?? this.def.duration?.turns;
    this.remaining = turns === undefined ? null : turns;
  }

  get chance(): DebuffChance | null {
    return this.baseChance === null
      ? null
      : {
          base: this.baseChance,
          applierId: this.applier.statUnit.id,
          bonus: this.ehrBonus,
        };
  }

  /**
   * Interned modifier snapshot; identical while stacks and landing chance
   * are unchanged, so hit groups can key on modifier identity.
   */
  modifiers(): readonly AppliedModifier[] {
    const scale = this.stacks;
    if (
      this.cached &&
      this.cachedScale === scale &&
      this.cachedChance === this.baseChance &&
      this.cachedBonus === this.ehrBonus
    ) {
      return this.cached;
    }
    this.cachedScale = scale;
    this.cachedChance = this.baseChance;
    this.cachedBonus = this.ehrBonus;
    const chance = this.chance;
    this.cached = (this.def.modifiers ?? []).map((def) =>
      appliedModifier(
        def,
        this.def.origin,
        this.source,
        this.applier.id,
        scale,
        chance
      )
    );
    return this.cached;
  }
}

export interface UnitBehaviour {
  readonly abilities: ReadonlyMap<string, AbilityDef>;
  readonly turnPolicy: TurnPolicy;
  readonly ultimatePolicy: UltimatePolicy | null;
}

export const ACTION_GAUGE = 10_000;

export class CombatUnit implements UnitView {
  readonly statuses = new Map<string, StatusInstance>();
  readonly counters = new Map<string, number>();
  /** Base, equipment, and unconditional permanent modifiers. */
  readonly panel: StatVector;
  /** Permanent modifiers that are filtered or scale with stats. */
  readonly conditional: AppliedModifier[] = [];
  energy = 0;
  maxEnergy = 0;
  /** Current HP as a share of Max HP. */
  hp = 1;
  /** A countdown or marker summon rather than an in-game summon. */
  countdown = false;
  /** Base aggro (Path-dependent); enemies target allies proportionally. */
  aggro = 100;
  /** Departed from the field: not in the Action Order nor targeted. */
  departed = false;
  /**
   * Elemental DMG Boost from Relics, kept apart from the panel because it
   * only reaches hits of its Combat Type and varies with equipment.
   */
  relicElemental: Partial<Record<CombatType, number>> = {};
  /** Remaining action-gauge distance; time to act = distance / speed. */
  distance = ACTION_GAUGE;
  inActionOrder = true;
  behaviour: UnitBehaviour | null = null;
  /** Fixed SPD for summons and countdowns. */
  fixedSpeed: number | null = null;
  /** Memosprite SPD rule relative to the owner. */
  speedRule: { ownerRatio: number; flat: number } | null = null;
  /** Expected extra turns granted but not yet whole (see grantExtraTurn). */
  pendingExtraTurns = 0;
  /**
   * Panel stats read by kits or the engine while the battle ran. Optimizer
   * timeline caches key on these besides SPD and Energy Regeneration Rate.
   */
  readonly statReads = new Set<string>();
  /** Computed SPD for engine-owned units such as Aha. */
  speedFunction: (() => number) | null = null;
  /** Certified Banger states: values sum, durations are independent. */
  readonly bangers: { value: number; remaining: number; skip: boolean }[] = [];

  constructor(
    readonly id: string,
    readonly kind: UnitKind,
    readonly definitionId: string,
    readonly combatType: CombatType,
    readonly level: number,
    panel: StatVector,
    readonly owner: CombatUnit | null,
    /** Team slot of the Character this unit belongs to. */
    readonly slot: number,
    readonly pathId: string
  ) {
    this.panel = panel;
  }

  /** The unit whose stats an attack by this unit scales with. */
  get statUnit(): CombatUnit {
    return this.kind === "summon" && this.owner ? this.owner : this;
  }

  get hpRatio(): number {
    return this.hp;
  }

  /** Aggro with statuses and auras ("chance of being attacked +X%"). */
  currentAggro(): number {
    const pct =
      readStat(this.panel, "aggroPct") + this.statusStat("aggroPct", true);
    return this.aggro * Math.max(0, 1 + pct);
  }

  get actionGauge(): number {
    return this.distance;
  }

  get speed(): number {
    if (this.speedFunction) {
      // Aha: SPD from the Elation team, plus statuses applied to Aha.
      const pct = this.statusStat("spdPct", false);
      const flat = this.statusStat("spdFlat", false);
      return Math.max(1, this.speedFunction() * (1 + pct) + flat);
    }
    if (this.fixedSpeed !== null) {
      // Summons, countdowns, and enemies ignore team auras, but statuses
      // applied to them (SPD buffs on a summon, Slow on an enemy) apply.
      const pct = this.statusStat("spdPct", false);
      const flat = this.statusStat("spdFlat", false);
      return Math.max(1, this.fixedSpeed * (1 + pct) + flat);
    }
    const pct = this.statusStat("spdPct", true);
    const flat = this.statusStat("spdFlat", true);
    if (this.speedRule && this.owner) {
      // A memosprite's base SPD comes from its owner; SPD% buffs on the
      // memosprite scale that base.
      const base =
        this.owner.speed * this.speedRule.ownerRatio + this.speedRule.flat;
      return Math.max(1, base * (1 + pct) + flat);
    }
    const vector = this.panel.slice();
    combineStat(vector, "spdPct", pct);
    combineStat(vector, "spdFlat", flat);
    return Math.max(1, finalStat(vector, "spd"));
  }

  /**
   * Sum of a stat from unfiltered, non-scaling statuses and permanent team
   * modifiers. A debuff applied with a base chance counts with that chance
   * (Effect Hit Rate is not read here, so timelines never depend on it).
   */
  /**
   * A stat from statuses and team auras only (no panel), without recording
   * a read: for values that evaluation adds to the panel it reads itself.
   */
  buffStat(stat: CombatStat): number {
    return this.statusStat(stat, true);
  }

  private statusStat(stat: CombatStat, withTeamAuras: boolean): number {
    let total = 0;
    const kept = this.keptUniques();
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      if (status.def.unique && kept.get(status.def.id) !== status) continue;
      const chance = Math.min(1, status.baseChance ?? 1);
      for (const modifier of status.modifiers()) {
        const { def } = modifier;
        if (def.stat !== stat || def.filter) continue;
        let value = def.value ?? 0;
        if (def.scaling) {
          const source =
            def.scaling.source === "applier" ? status.applier : this;
          value += scaledValue(source.scalingInput(def.scaling), def.scaling);
        }
        total += value * modifier.scale * chance;
      }
    }
    if (!withTeamAuras) return total;
    for (const modifier of this.conditional) {
      if (
        modifier.def.stat === stat &&
        !modifier.def.filter &&
        !modifier.def.scaling
      ) {
        total += (modifier.def.value ?? 0) * modifier.scale;
      }
    }
    return total;
  }

  statusKey(def: StatusDef, applier: CombatUnit): string {
    return `${def.id}@${applier.id}`;
  }

  findStatus(def: StatusDef, applier?: UnitView): StatusInstance | undefined {
    if (applier) return this.statuses.get(`${def.id}@${applier.id}`);
    for (const status of this.statuses.values()) {
      if (status.def === def) return status;
    }
    return undefined;
  }

  stacks(def: StatusDef, applier?: UnitView): number {
    return this.findStatus(def, applier)?.stacks ?? 0;
  }

  has(def: StatusDef, applier?: UnitView): boolean {
    return this.stacks(def, applier) > 0;
  }

  remainingTurns(def: StatusDef, applier?: UnitView): number | null {
    return this.findStatus(def, applier)?.remaining ?? null;
  }

  hasFamily(family: StatusFamily): boolean {
    for (const status of this.statuses.values()) {
      if (status.stacks > 0 && statusFamilies(status.def).includes(family)) {
        return true;
      }
    }
    return false;
  }

  /** Status IDs and `family:<name>` entries, for hit-time snapshots. */
  statusSignature(): string[] {
    const entries = new Set<string>();
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      entries.add(status.def.id);
      for (const family of statusFamilies(status.def)) {
        entries.add(`family:${family}`);
      }
    }
    return [...entries].sort();
  }

  /** Statuses split by landing certainty; undefined when all are certain. */
  chanceSnapshot(): TargetChances | undefined {
    const certain = new Set<string>();
    const pending: PendingStatus[] = [];
    let certainDebuffs = 0;
    let certainDots = 0;
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      const entries = [
        status.def.id,
        ...statusFamilies(status.def).map((family) => `family:${family}`),
      ];
      const chance = status.chance;
      if (chance) {
        pending.push({
          ...chance,
          entries,
          debuff: status.def.debuff ?? false,
          dot: status.def.dot !== undefined,
        });
        continue;
      }
      for (const entry of entries) certain.add(entry);
      if (status.def.debuff) certainDebuffs += 1;
      if (status.def.dot) certainDots += 1;
    }
    if (pending.length === 0) return undefined;
    return {
      certain: [...certain].sort(),
      certainDebuffs,
      certainDots,
      pending,
    };
  }

  /** DoT statuses on this unit. */
  dotCount(): number {
    let count = 0;
    for (const status of this.statuses.values()) {
      if (status.def.dot && status.stacks > 0) count += 1;
    }
    return count;
  }

  /**
   * A stat with the statuses and permanent modifiers on this unit right now
   * (scaling ones included), unlike `panelStat`. Filtered modifiers count
   * only when `hit` matches them. Recorded like `panelStat`, so optimizer
   * timelines re-simulate when it changes.
   */
  currentStat(
    stat: CombatStat | "hp" | "atk" | "def" | "spd",
    hit?: HitDescriptor
  ): number {
    if (stat === "spd") return this.speed;
    this.statReads.add(stat);
    const vector = this.panel.slice();
    const final = stat === "hp" || stat === "atk" || stat === "def";
    const relevant = (candidate: CombatStat) =>
      final
        ? candidate === `${stat}Pct` ||
          candidate === `${stat}Flat` ||
          candidate === `${stat}Base`
        : candidate === stat;
    const add = (
      def: ModifierDef,
      scale: number,
      applier: CombatUnit | null
    ) => {
      if (!relevant(def.stat) || INCOMING_STATS.has(def.stat)) return;
      if (def.filter && !(hit && modifierApplies(def.stat, def.filter, hit)))
        return;
      let value = (def.value ?? 0) * scale;
      if (def.scaling) {
        const source = def.scaling.source === "applier" ? applier : this;
        if (source) {
          value += scaledValue(source.scalingInput(def.scaling), {
            ...def.scaling,
            ratio: def.scaling.ratio * scale,
          });
        }
      }
      combineStat(vector, def.stat, value);
    };
    let kept: Map<string, StatusInstance> | null = null;
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      if (!status.def.modifiers?.some((def) => relevant(def.stat))) continue;
      if (status.def.unique) {
        kept ??= this.keptUniques();
        if (kept.get(status.def.id) !== status) continue;
      }
      for (const modifier of status.modifiers()) {
        add(modifier.def, modifier.scale, status.applier);
      }
    }
    for (const modifier of this.conditional) {
      add(
        modifier.def,
        modifier.scale,
        modifier.applierId === this.id ? this : null
      );
    }
    return final ? finalStat(vector, stat) : readStat(vector, stat);
  }

  debuffCount(): number {
    let count = 0;
    for (const status of this.statuses.values()) {
      if (status.def.debuff && status.stacks > 0) count += 1;
    }
    return count;
  }

  /**
   * A scaling input read from the steady panel (as damage evaluation does
   * for appliers). Recorded like `panelStat`, so optimizer caches see it.
   */
  scalingInput(scaling: StatScaling): number {
    if (scaling.stat === "maxEnergy") return this.maxEnergy;
    return this.panelStat(scaling.stat);
  }

  panelStat(stat: CombatStat | "hp" | "atk" | "def" | "spd"): number {
    this.statReads.add(stat);
    if (stat === "hp" || stat === "atk" || stat === "def" || stat === "spd") {
      return finalStat(this.panel, stat);
    }
    return readStat(this.panel, stat);
  }

  counter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  certifiedBanger(): number {
    let total = 0;
    for (const banger of this.bangers) total += banger.value;
    return total;
  }

  /**
   * For each `unique` status ID, the copy that applies: the largest total
   * of its modifier values (stacks, landing chance, and scaling included),
   * then the first applied.
   */
  private keptUniques(): Map<string, StatusInstance> {
    const kept = new Map<string, StatusInstance>();
    const strength = (status: StatusInstance) => {
      let total = 0;
      for (const { def } of status.modifiers()) {
        let value = Math.abs(def.value ?? 0);
        if (def.scaling) {
          const source =
            def.scaling.source === "applier" ? status.applier : this;
          value += Math.abs(
            scaledValue(source.scalingInput(def.scaling), def.scaling)
          );
        }
        total += value;
      }
      return total * status.stacks * Math.min(1, status.baseChance ?? 1);
    };
    for (const status of this.statuses.values()) {
      if (!status.def.unique || status.stacks <= 0) continue;
      const current = kept.get(status.def.id);
      if (!current || strength(status) > strength(current) + 1e-12) {
        kept.set(status.def.id, status);
      }
    }
    return kept;
  }

  /** Modifiers from statuses currently on this unit (snapshot). */
  statusModifiers(side: "outgoing" | "incoming"): AppliedModifier[] {
    const result: AppliedModifier[] = [];
    const kept = this.keptUniques();
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      if (status.def.unique && kept.get(status.def.id) !== status) continue;
      for (const modifier of status.modifiers()) {
        if (INCOMING_STATS.has(modifier.def.stat) === (side === "incoming")) {
          result.push(modifier);
        }
      }
    }
    return result;
  }
}

export class EnemyUnit extends CombatUnit implements EnemyView {
  toughness: number;
  maxToughness: number;
  broken = false;
  readonly weaknesses: Set<CombatType>;
  /**
   * Weaknesses from the enemy's data. RES comes from these only: implanted
   * Weaknesses count for Toughness and filters, and kits lower RES
   * separately when the text says so.
   */
  readonly nativeWeaknesses: ReadonlySet<CombatType>;
  /** Implanted Weaknesses with remaining enemy turns (null: permanent). */
  readonly implants = new Map<CombatType, number | null>();
  readonly resistance: number;
  readonly weakResistance: number;
  readonly enemyLevel: number;
  readonly effectResistance: number;

  constructor(
    id: string,
    options: {
      level: number;
      speed: number;
      maxToughness: number;
      weaknesses: readonly CombatType[];
      resistance: number;
      weakResistance: number;
      effectResistance: number;
      panel: StatVector;
    }
  ) {
    super(
      id,
      "enemy",
      id,
      "Physical",
      options.level,
      options.panel,
      null,
      -1,
      ""
    );
    this.fixedSpeed = options.speed;
    this.maxToughness = options.maxToughness;
    this.toughness = options.maxToughness;
    this.weaknesses = new Set(options.weaknesses);
    this.nativeWeaknesses = new Set(options.weaknesses);
    this.resistance = options.resistance;
    this.weakResistance = options.weakResistance;
    this.enemyLevel = options.level;
    this.effectResistance = options.effectResistance;
  }

  resistanceAgainst(combatType: CombatType): number {
    return this.nativeWeaknesses.has(combatType)
      ? this.weakResistance
      : this.resistance;
  }
}

/**
 * Families a status belongs to: its declared family, plus `defReduced` for
 * any status that lowers its holder's DEF.
 */
export function statusFamilies(def: StatusDef): readonly StatusFamily[] {
  const families: StatusFamily[] = [];
  if (def.family) families.push(def.family);
  if (
    def.modifiers?.some(
      (modifier) =>
        modifier.stat === "defReduction" &&
        ((modifier.value ?? 0) > 0 || modifier.scaling !== undefined)
    )
  ) {
    families.push("defReduced");
  }
  return families;
}
