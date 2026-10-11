import { BREAK_EFFECT_USES_TOUGHNESS } from "../battle/breakEffects";
import type { CombatLog, HitRecord } from "../battle/log";
import type {
  AppliedModifier,
  CombatUnit,
  EnemyUnit,
  PendingStatus,
  TargetChances,
} from "../battle/units";
import type { StatScaling } from "../kit/model";
import { scaledValue } from "../kit/scaling";
import {
  BREAK_COEFFICIENT,
  breakLevelBase,
  type CritMode,
  critMultiplier,
  defMultiplier,
  effectHitChance,
  resMultiplier,
  toughnessFactor,
  toughnessMitigation,
} from "../model/formulas";
import {
  type CombatStat,
  type CombatType,
  combineStat,
  finalStat,
  INCOMING_STATS,
  readStat,
  type ScalingStat,
  type StatVector,
} from "../model/stats";
import {
  type HitDescriptor,
  type HitFilter,
  modifierApplies,
} from "../model/tags";

/** Multiplier zones of one evaluated hit group, for breakdown display. */
export interface DamageZones {
  base: number;
  dmgBoost: number;
  crit: number;
  def: number;
  res: number;
  vulnerability: number;
  mitigation: number;
  toughness: number;
  multiplier: number;
  trueDmg: number;
  special: number;
}

/**
 * Equipment-dependent inputs per unit. The optimizer swaps these for one
 * unit while every other part of a compiled log stays fixed.
 */
export interface UnitPanels {
  panel(unitId: string): StatVector;
  /** Relic Elemental DMG Boost of a unit for a Combat Type. */
  elemental?(unitId: string, combatType: CombatType): number;
}

interface ScalingModifier {
  stat: CombatStat;
  value: number;
  scaling: StatScaling;
  holderId: string;
  applierId: string;
  /** Applies only as far as base-chance target statuses landed. */
  gate?: Gate;
}

interface ConstantModifier {
  stat: CombatStat;
  value: number;
  gate?: Gate;
}

/**
 * A target-state filter reduced to the base-chance statuses (indices into
 * the sample's `targetChances.pending`) that decide it.
 */
interface Gate {
  /** Statuses any of which satisfies a status/family condition. */
  readonly any: readonly number[] | null;
  readonly debuffs: { needed: number; from: readonly number[] } | null;
  readonly dots: { needed: number; from: readonly number[] } | null;
}

function compileGate(filter: HitFilter, chances: TargetChances): Gate {
  const names = [
    ...(filter.targetStatuses ?? []),
    ...(filter.targetFamilies ?? []).map((family) => `family:${family}`),
  ];
  const indices = (match: (status: PendingStatus) => boolean) =>
    chances.pending.flatMap((status, index) => (match(status) ? [index] : []));
  return {
    any:
      names.length > 0 && !names.some((name) => chances.certain.includes(name))
        ? indices((status) =>
            status.entries.some((entry) => names.includes(entry))
          )
        : null,
    debuffs:
      filter.minTargetDebuffs === undefined
        ? null
        : {
            needed: filter.minTargetDebuffs - chances.certainDebuffs,
            from: indices((status) => status.debuff),
          },
    dots:
      filter.minTargetDots === undefined
        ? null
        : {
            needed: filter.minTargetDots - chances.certainDots,
            from: indices((status) => status.dot),
          },
  };
}

/** Probability that a gate passes, given each pending status's landing. */
function gateChance(gate: Gate, landed: readonly number[]): number {
  let probability = 1;
  if (gate.any) {
    let missed = 1;
    for (const index of gate.any) missed *= 1 - (landed[index] ?? 0);
    probability *= 1 - missed;
  }
  for (const count of [gate.debuffs, gate.dots]) {
    if (!count) continue;
    probability *= atLeast(
      count.needed,
      count.from.map((index) => landed[index] ?? 0)
    );
  }
  return probability;
}

/**
 * Hits that share everything but their multiplier and weight. Damage is
 * linear in both, so one evaluation covers the group.
 */
export interface HitGroup {
  readonly records: readonly HitRecord[];
  readonly sample: HitRecord;
  /** Σ weight × multiplier (or × Toughness reduced for Super Break). */
  readonly amount: number;
  readonly statUnitId: string;
  readonly scalingUnitId: string;
  readonly constant: readonly ConstantModifier[];
  /**
   * Constant modifiers on the scaling unit when it is not the stat unit
   * (a memosprite hit on its owner's Max HP).
   */
  readonly scalingConstant: readonly { stat: CombatStat; value: number }[];
  readonly scaling: readonly ScalingModifier[];
  readonly incoming: {
    vulnerability: number;
    defReduction: number;
    resReduction: number;
    mitigation: number;
  };
  /**
   * Incoming modifiers resolved per evaluation: debuffs whose landing chance
   * needs the applier's Effect Hit Rate, and values scaling with the
   * applier's stats.
   */
  readonly incomingChance: readonly ChanceModifier[];
}

type IncomingStat =
  | "vulnerability"
  | "defReduction"
  | "resReduction"
  | "dmgMitigation";

interface ChanceModifier {
  stat: IncomingStat;
  value: number;
  /** Null when the modifier always applies. */
  base: number | null;
  applierId: string;
  /** The applier's status Effect Hit Rate when the debuff was applied. */
  bonus: number;
  scaling?: StatScaling;
}

function descriptor(record: HitRecord, attacker: CombatUnit): HitDescriptor {
  return {
    tags: record.tags,
    kind: record.kind,
    combatType: record.combatType,
    attackerKind: attacker.kind,
    role: record.role,
    targetWeaknesses: new Set(record.targetWeaknesses),
    targetStatuses: new Set(record.targetStatuses),
    targetDebuffs: record.targetDebuffs,
    targetDots: record.targetDots,
    targetBroken: record.targetBroken,
  };
}

function modifierKey(modifiers: readonly AppliedModifier[]): string {
  return modifiers.map((modifier) => modifier.uid).join(",");
}

function groupKey(record: HitRecord): string {
  const hit = record.hit;
  return [
    record.attackerId,
    record.statUnitId,
    record.scalingUnitId,
    record.abilityId,
    record.origin,
    record.role,
    record.kind,
    record.combatType,
    record.tags.join("+"),
    record.targetId,
    record.targetBroken ? 1 : 0,
    record.targetWeaknesses.join("+"),
    record.targetStatuses.join("+"),
    record.targetDebuffs,
    record.targetDots,
    record.targetChances?.pending
      .map(
        (status) =>
          `${status.applierId}:${status.base}+${status.bonus}:${status.debuff ? 1 : 0}${status.dot ? 1 : 0}:${status.entries.join("+")}`
      )
      .join(";") ?? "",
    hit.stat ?? "atk",
    hit.critOverride
      ? `${hit.critOverride.critRate}/${hit.critOverride.critDmg}`
      : "",
    hit.elationScaling ?? "",
    record.breakEffect ?? "",
    record.maxToughness ?? "",
    record.punchline ?? "",
    record.chance
      ? `${record.chance.base}@${record.chance.applierId}+${record.chance.bonus}`
      : "",
    modifierKey(record.attackerModifiers),
    modifierKey(record.scalingModifiers ?? []),
    modifierKey(record.targetModifiers),
  ].join("|");
}

/**
 * A combat log compiled for repeated evaluation. Only unit panels vary
 * between evaluations, which is what equipment optimization changes.
 */
export class DamageModel {
  readonly groups: HitGroup[] = [];

  constructor(
    readonly log: CombatLog,
    private readonly units: ReadonlyMap<string, CombatUnit>,
    private readonly enemies: ReadonlyMap<string, EnemyUnit>,
    readonly critMode: CritMode = "expected"
  ) {
    const buckets = new Map<string, HitRecord[]>();
    for (const record of log.hits) {
      const key = groupKey(record);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(record);
      else buckets.set(key, [record]);
    }
    for (const records of buckets.values()) {
      this.groups.push(this.compileGroup(records));
    }
  }

  private unit(id: string): CombatUnit {
    const unit = this.units.get(id);
    if (!unit) throw new Error(`Unknown combat unit ${id}`);
    return unit;
  }

  private compileGroup(records: readonly HitRecord[]): HitGroup {
    const sample = records[0];
    if (!sample) throw new Error("Empty hit group");
    const attacker =
      this.units.get(sample.attackerId) ?? this.unit(sample.statUnitId);
    const statUnit = this.unit(sample.statUnitId);
    const hit = descriptor(sample, attacker);
    const constant: ConstantModifier[] = [];
    const chances = sample.targetChances;
    const certain: HitDescriptor = chances
      ? {
          ...hit,
          targetStatuses: new Set(chances.certain),
          targetDebuffs: chances.certainDebuffs,
          targetDots: chances.certainDots,
        }
      : hit;
    const scaling: ScalingModifier[] = [];
    const outgoing = [...statUnit.conditional, ...sample.attackerModifiers];
    for (const modifier of outgoing) {
      const { def } = modifier;
      if (INCOMING_STATS.has(def.stat)) continue;
      if (!modifierApplies(def.stat, def.filter, hit)) continue;
      // Passes only thanks to statuses that may not have landed.
      const gate =
        chances && def.filter && !modifierApplies(def.stat, def.filter, certain)
          ? compileGate(def.filter, chances)
          : undefined;
      if (def.scaling) {
        scaling.push({
          stat: def.stat,
          value: (def.value ?? 0) * modifier.scale,
          scaling: {
            ...def.scaling,
            ratio: def.scaling.ratio * modifier.scale,
          },
          holderId: statUnit.id,
          applierId: modifier.applierId,
          ...(gate ? { gate } : {}),
        });
      } else if (def.value) {
        constant.push({
          stat: def.stat,
          value: def.value * modifier.scale,
          ...(gate ? { gate } : {}),
        });
      }
    }
    const scalingConstant: { stat: CombatStat; value: number }[] = [];
    if (sample.scalingUnitId !== statUnit.id) {
      const scalingUnit = this.unit(sample.scalingUnitId);
      for (const modifier of [
        ...scalingUnit.conditional,
        ...(sample.scalingModifiers ?? []),
      ]) {
        const { def } = modifier;
        if (INCOMING_STATS.has(def.stat) || def.scaling || !def.value) continue;
        if (!modifierApplies(def.stat, def.filter, hit)) continue;
        scalingConstant.push({
          stat: def.stat,
          value: def.value * modifier.scale,
        });
      }
    }
    const target = this.enemies.get(sample.targetId);
    const incoming = {
      vulnerability: 0,
      defReduction: 0,
      resReduction: 0,
      mitigation: 0,
    };
    const incomingChance: ChanceModifier[] = [];
    const incomingModifiers = [
      ...(target?.conditional ?? []),
      ...sample.targetModifiers,
    ];
    for (const modifier of incomingModifiers) {
      const { def } = modifier;
      if (!INCOMING_STATS.has(def.stat)) continue;
      if (!modifierApplies(def.stat, def.filter, hit)) continue;
      const value = (def.value ?? 0) * modifier.scale;
      if (modifier.chance || def.scaling) {
        incomingChance.push({
          stat: def.stat as IncomingStat,
          value,
          base: modifier.chance?.base ?? null,
          applierId: modifier.chance?.applierId ?? modifier.applierId,
          bonus: modifier.chance?.bonus ?? 0,
          ...(def.scaling
            ? {
                scaling: {
                  ...def.scaling,
                  ratio: def.scaling.ratio * modifier.scale,
                },
              }
            : {}),
        });
        continue;
      }
      if (def.stat === "dmgMitigation") {
        incoming.mitigation = 1 - (1 - incoming.mitigation) * (1 - value);
      } else {
        incoming[
          def.stat as "vulnerability" | "defReduction" | "resReduction"
        ] += value;
      }
    }
    let amount = 0;
    for (const record of records) {
      if (record.kind === "superBreak") {
        amount += record.weight * (record.toughnessReduced ?? 0);
      } else {
        amount += record.weight * record.multiplier;
      }
    }
    return {
      records,
      sample,
      amount,
      statUnitId: statUnit.id,
      scalingUnitId: sample.scalingUnitId,
      constant,
      scalingConstant,
      scaling,
      incoming,
      incomingChance,
    };
  }

  /** Expected chance that a debuff from `applierId` lands on the target. */
  private landingChance(
    panels: UnitPanels,
    base: number,
    applierId: string,
    target: EnemyUnit,
    bonus = 0
  ): number {
    const effectHitRate =
      readStat(this.panelOf(panels, applierId), "effectHitRate") + bonus;
    return effectHitChance(base, effectHitRate, target.effectResistance);
  }

  private elementalOf(
    panels: UnitPanels,
    unitId: string,
    combatType: CombatType
  ): number {
    const unit = this.unit(unitId);
    const owner = unit.kind === "memosprite" && unit.owner ? unit.owner : unit;
    return panels.elemental
      ? panels.elemental(owner.id, combatType)
      : (owner.relicElemental[combatType] ?? 0);
  }

  /** Memosprites read their owner's panel; equipment lives on the owner. */
  private panelOf(panels: UnitPanels, unitId: string): StatVector {
    const unit = this.unit(unitId);
    return panels.panel(
      unit.kind === "memosprite" && unit.owner ? unit.owner.id : unitId
    );
  }

  /** Scaling-unit stats for a group whose scaling unit is not its stat unit. */
  private scalingStats(group: HitGroup, panels: UnitPanels): StatVector {
    const vector = this.panelOf(panels, group.scalingUnitId).slice();
    for (const { stat, value } of group.scalingConstant)
      combineStat(vector, stat, value);
    return vector;
  }

  /** Landing chance of each base-chance status on the group's target. */
  private pendingLanding(group: HitGroup, panels: UnitPanels): number[] {
    const chances = group.sample.targetChances;
    const target = this.enemies.get(group.sample.targetId);
    if (!chances || !target) return [];
    return chances.pending.map((status) =>
      this.landingChance(
        panels,
        status.base,
        status.applierId,
        target,
        status.bonus
      )
    );
  }

  /** Attacker stats for a group under the given panels. */
  groupStats(group: HitGroup, panels: UnitPanels): StatVector {
    const vector = this.panelOf(panels, group.statUnitId).slice();
    let landed: number[] | null = null;
    const share = (gate: Gate | undefined) => {
      if (!gate) return 1;
      landed ??= this.pendingLanding(group, panels);
      return gateChance(gate, landed);
    };
    for (const { stat, value, gate } of group.constant) {
      combineStat(vector, stat, value * share(gate));
    }
    if (group.scaling.length === 0) return vector;
    const phaseOne = vector.slice();
    for (const modifier of group.scaling) {
      const sourceVector =
        modifier.scaling.source === "holder"
          ? phaseOne
          : this.panelOf(panels, modifier.applierId);
      const sourceUnit =
        modifier.scaling.source === "holder"
          ? this.unit(modifier.holderId)
          : this.unit(modifier.applierId);
      const input = readScalingInput(
        sourceVector,
        sourceUnit,
        modifier.scaling
      );
      combineStat(
        vector,
        modifier.stat,
        (modifier.value + scaledValue(input, modifier.scaling)) *
          share(modifier.gate)
      );
    }
    return vector;
  }

  evaluateGroup(
    group: HitGroup,
    panels: UnitPanels,
    zonesOut?: DamageZones
  ): number {
    const record = group.sample;
    const stats = this.groupStats(group, panels);
    const statUnit = this.unit(group.statUnitId);
    const target = this.enemies.get(record.targetId);
    if (!target) return 0;
    const incoming = { ...group.incoming };
    for (const modifier of group.incomingChance) {
      let value = modifier.value;
      if (modifier.scaling) {
        // Incoming values scale with the applier's stats (the holder is
        // an enemy without a panel of its own).
        const applier = this.unit(modifier.applierId);
        value += scaledValue(
          readScalingInput(
            this.panelOf(panels, modifier.applierId),
            applier,
            modifier.scaling
          ),
          modifier.scaling
        );
      }
      if (modifier.base !== null) {
        value *= this.landingChance(
          panels,
          modifier.base,
          modifier.applierId,
          target,
          modifier.bonus
        );
      }
      if (modifier.stat === "dmgMitigation") {
        incoming.mitigation = 1 - (1 - incoming.mitigation) * (1 - value);
      } else {
        incoming[modifier.stat] += value;
      }
    }
    const chance = record.chance
      ? this.landingChance(
          panels,
          record.chance.base,
          record.chance.applierId,
          target,
          record.chance.bonus
        )
      : 1;
    const defShred = incoming.defReduction + readStat(stats, "defIgnore");
    const def = defMultiplier(statUnit.level, target.enemyLevel, defShred);
    const res = resMultiplier(
      target.resistanceAgainst(record.combatType) - incoming.resReduction,
      readStat(stats, "resPen")
    );
    const vulnerability = 1 + incoming.vulnerability;
    const mitigation = 1 - incoming.mitigation;
    const toughness = toughnessMitigation(record.targetBroken);
    const multiplier = 1 + readStat(stats, "dmgMultiplier");
    const trueDmg = 1 + readStat(stats, "trueDmg");
    const breakEffect = readStat(stats, "breakEffect");
    const levelBase = breakLevelBase(statUnit.level);
    let base = 0;
    let dmgBoost = 1;
    let crit = 1;
    let special = 1;
    switch (record.kind) {
      case "direct":
      case "dot":
      case "elation": {
        const scalingVector =
          group.scalingUnitId === group.statUnitId
            ? stats
            : this.scalingStats(group, panels);
        const scalingStat: ScalingStat = record.hit.stat ?? "atk";
        const multiplierBoost = readStat(stats, "multiplierBoost");
        const elationTerm =
          (record.hit.elationScaling ?? 0) * readStat(stats, "elation");
        base =
          (group.amount +
            (multiplierBoost + elationTerm) * totalWeight(group)) *
          finalStat(scalingVector, scalingStat);
        if (record.kind === "elation") {
          // Elation DMG: its own base and Elation zone replace DMG Boost.
          base =
            group.amount *
            levelBase *
            2 *
            (1 + readStat(stats, "elation")) *
            (1 + readStat(stats, "merrymaking"));
          const punchline = record.punchline ?? 0;
          special = 1 + (5 * punchline) / (punchline + 240);
          dmgBoost = 1;
        } else {
          dmgBoost =
            1 +
            readStat(stats, "dmgBoost") +
            this.elementalOf(panels, group.statUnitId, record.combatType);
        }
        if (record.kind !== "dot") {
          const override = record.hit.critOverride;
          crit = override
            ? critMultiplier(override.critRate, override.critDmg, this.critMode)
            : critMultiplier(
                readStat(stats, "critRate"),
                readStat(stats, "critDmg"),
                this.critMode
              );
        }
        break;
      }
      case "break": {
        dmgBoost = 1 + readStat(stats, "dmgBoost");
        const effect = record.breakEffect;
        const maxToughness = record.maxToughness ?? target.maxToughness;
        if (effect) {
          base =
            group.amount *
            levelBase *
            (BREAK_EFFECT_USES_TOUGHNESS[effect]
              ? toughnessFactor(maxToughness)
              : 1);
        } else {
          base =
            group.amount *
            levelBase *
            BREAK_COEFFICIENT[record.combatType] *
            toughnessFactor(maxToughness);
        }
        special = 1 + breakEffect;
        break;
      }
      case "superBreak": {
        dmgBoost = 1 + readStat(stats, "dmgBoost");
        const superBreak = readStat(stats, "superBreakDmg");
        if (superBreak <= 0) return 0;
        base = (group.amount * levelBase) / 10;
        special = (1 + breakEffect) * superBreak;
        break;
      }
      case "fixed":
        base = group.amount;
        break;
    }
    const damage =
      record.kind === "fixed"
        ? base * vulnerability * mitigation * chance
        : chance *
          base *
          dmgBoost *
          crit *
          def *
          res *
          vulnerability *
          mitigation *
          toughness *
          multiplier *
          trueDmg *
          special;
    if (zonesOut) {
      zonesOut.base = base;
      zonesOut.dmgBoost = dmgBoost;
      zonesOut.crit = crit;
      zonesOut.def = def;
      zonesOut.res = res;
      zonesOut.vulnerability = vulnerability;
      zonesOut.mitigation = mitigation;
      zonesOut.toughness = toughness;
      zonesOut.multiplier = multiplier;
      zonesOut.trueDmg = trueDmg;
      zonesOut.special = special;
    }
    return damage;
  }

  total(panels: UnitPanels, include?: (group: HitGroup) => boolean): number {
    let total = 0;
    for (const group of this.groups) {
      if (include && !include(group)) continue;
      total += this.evaluateGroup(group, panels);
    }
    return total;
  }
}

function totalWeight(group: HitGroup): number {
  let total = 0;
  for (const record of group.records) total += record.weight;
  return total;
}

function readScalingInput(
  vector: StatVector,
  unit: CombatUnit,
  scaling: StatScaling
): number {
  const stat = scaling.stat;
  if (stat === "hp" || stat === "atk" || stat === "def" || stat === "spd") {
    return finalStat(vector, stat);
  }
  if (stat === "maxEnergy") return unit.maxEnergy;
  return readStat(vector, stat);
}

/** Default panels: each unit's own assembled panel. */
export function unitPanels(units: ReadonlyMap<string, CombatUnit>): UnitPanels {
  const unit = (unitId: string) => {
    const found = units.get(unitId);
    if (!found) throw new Error(`Unknown combat unit ${unitId}`);
    return found;
  };
  return {
    panel: (unitId) => unit(unitId).panel,
    elemental: (unitId, combatType) =>
      unit(unitId).relicElemental[combatType] ?? 0,
  };
}

/** P(at least `needed` of independent events with these probabilities). */
function atLeast(needed: number, probabilities: readonly number[]): number {
  if (needed <= 0) return 1;
  if (needed > probabilities.length) return 0;
  // distribution[k] = P(exactly k events so far)
  let distribution = [1];
  for (const p of probabilities) {
    const next = new Array<number>(distribution.length + 1).fill(0);
    distribution.forEach((mass, count) => {
      next[count] = (next[count] ?? 0) + mass * (1 - p);
      next[count + 1] = (next[count + 1] ?? 0) + mass * p;
    });
    distribution = next;
  }
  return distribution.slice(needed).reduce((sum, mass) => sum + mass, 0);
}
