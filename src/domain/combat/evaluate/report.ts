import type { CombatLog } from "../battle/log";
import type { CombatUnit } from "../battle/units";
import type { AbilityKind, EffectOrigin } from "../kit/model";
import type { DamageKind } from "../model/tags";
import type { DamageModel, DamageZones, HitGroup, UnitPanels } from "./damage";

export interface AbilityDamage {
  /** Team slot of the Character credited with the damage. */
  readonly slot: number;
  readonly abilityId: string;
  readonly abilityKind: AbilityKind;
  readonly kind: DamageKind;
  readonly origin: EffectOrigin;
  readonly damage: number;
  readonly hits: number;
}

export interface MemberDamage {
  readonly slot: number;
  readonly damage: number;
  readonly share: number;
}

export interface DamageReport {
  readonly total: number;
  /** Damage per 100 action value, comparable across cycle counts. */
  readonly perCycle: number;
  readonly duration: number;
  readonly members: readonly MemberDamage[];
  readonly abilities: readonly AbilityDamage[];
  readonly byCycle: readonly number[];
}

function creditedSlot(unit: CombatUnit | undefined): number {
  if (!unit) return -1;
  return unit.slot;
}

export function buildDamageReport(
  model: DamageModel,
  panels: UnitPanels,
  units: ReadonlyMap<string, CombatUnit>,
  log: CombatLog
): DamageReport {
  const abilities = new Map<string, AbilityDamage>();
  const members = new Map<number, number>();
  const byCycle: number[] = Array.from({ length: log.cycles }, () => 0);
  let total = 0;
  for (const group of model.groups) {
    const damage = model.evaluateGroup(group, panels);
    if (damage === 0) continue;
    total += damage;
    const sample = group.sample;
    const slot = creditedSlot(
      units.get(sample.attackerId) ?? units.get(sample.statUnitId)
    );
    members.set(slot, (members.get(slot) ?? 0) + damage);
    const key = `${slot}|${sample.abilityId}|${sample.kind}`;
    const previous = abilities.get(key);
    abilities.set(key, {
      slot,
      abilityId: sample.abilityId,
      abilityKind: sample.abilityKind,
      kind: sample.kind,
      origin: sample.origin,
      damage: (previous?.damage ?? 0) + damage,
      hits: (previous?.hits ?? 0) + group.records.length,
    });
    distributeByCycle(group, damage, byCycle);
  }
  const duration = Math.max(log.duration, 1);
  return {
    total,
    perCycle: (total / duration) * 100,
    duration: log.duration,
    members: [...members.entries()]
      .filter(([slot]) => slot >= 0)
      .map(([slot, damage]) => ({
        slot,
        damage,
        share: total > 0 ? damage / total : 0,
      }))
      .sort((left, right) => left.slot - right.slot),
    abilities: [...abilities.values()].sort(
      (left, right) => right.damage - left.damage
    ),
    byCycle,
  };
}

function distributeByCycle(
  group: HitGroup,
  damage: number,
  byCycle: number[]
): void {
  let weightTotal = 0;
  for (const record of group.records)
    weightTotal += record.weight * Math.abs(record.multiplier || 1);
  if (weightTotal <= 0) return;
  for (const record of group.records) {
    const share =
      (record.weight * Math.abs(record.multiplier || 1)) / weightTotal;
    const cycle = Math.min(byCycle.length - 1, record.cycle);
    byCycle[cycle] = (byCycle[cycle] ?? 0) + damage * share;
  }
}

export type { DamageZones };
