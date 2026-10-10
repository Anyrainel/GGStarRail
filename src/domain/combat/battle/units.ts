import type {
  AbilityDef,
  ApplyStatusOptions,
  EnemyView,
  TurnPolicy,
  UltimatePolicy,
  UnitView,
} from "../kit/api";
import type { EffectOrigin, ModifierDef, StatusDef } from "../kit/model";
import {
  type CombatStat,
  type CombatType,
  combineStat,
  finalStat,
  INCOMING_STATS,
  readStat,
  type StatVector,
} from "../model/stats";
import type { StatusFamily, UnitKind } from "../model/tags";

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
      : { base: this.baseChance, applierId: this.applier.statUnit.id };
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
      this.cachedChance === this.baseChance
    ) {
      return this.cached;
    }
    this.cachedScale = scale;
    this.cachedChance = this.baseChance;
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
  /** Base aggro (Path-dependent); enemies target allies proportionally. */
  aggro = 100;
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

  get actionGauge(): number {
    return this.distance;
  }

  get speed(): number {
    if (this.speedFunction) return this.speedFunction();
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
      return (
        this.owner.speed * this.speedRule.ownerRatio +
        this.speedRule.flat +
        flat
      );
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
  private statusStat(stat: CombatStat, withTeamAuras: boolean): number {
    let total = 0;
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      const chance = Math.min(1, status.baseChance ?? 1);
      for (const modifier of status.modifiers()) {
        if (
          modifier.def.stat === stat &&
          !modifier.def.filter &&
          !modifier.def.scaling
        ) {
          total += (modifier.def.value ?? 0) * modifier.scale * chance;
        }
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

  hasFamily(family: StatusFamily): boolean {
    for (const status of this.statuses.values()) {
      if (status.def.family === family && status.stacks > 0) return true;
    }
    return false;
  }

  /** Status IDs and `family:<name>` entries, for hit-time snapshots. */
  statusSignature(): string[] {
    const entries = new Set<string>();
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      entries.add(status.def.id);
      if (status.def.family) entries.add(`family:${status.def.family}`);
    }
    return [...entries].sort();
  }

  debuffCount(): number {
    let count = 0;
    for (const status of this.statuses.values()) {
      if (status.def.debuff && status.stacks > 0) count += 1;
    }
    return count;
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

  /** Modifiers from statuses currently on this unit (snapshot). */
  statusModifiers(side: "outgoing" | "incoming"): AppliedModifier[] {
    const result: AppliedModifier[] = [];
    const strongestUnique = new Map<string, StatusInstance>();
    for (const status of this.statuses.values()) {
      if (!status.def.unique || status.stacks <= 0) continue;
      const current = strongestUnique.get(status.def.id);
      if (!current || status.stacks > current.stacks) {
        strongestUnique.set(status.def.id, status);
      }
    }
    for (const status of this.statuses.values()) {
      if (status.stacks <= 0) continue;
      if (status.def.unique && strongestUnique.get(status.def.id) !== status) {
        continue;
      }
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
    this.resistance = options.resistance;
    this.weakResistance = options.weakResistance;
    this.enemyLevel = options.level;
    this.effectResistance = options.effectResistance;
  }

  resistanceAgainst(combatType: CombatType): number {
    return this.weaknesses.has(combatType)
      ? this.weakResistance
      : this.resistance;
  }
}
