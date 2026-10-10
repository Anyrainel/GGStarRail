import type { BattleOptions } from "../battle/battle";
import type { KitRegistry } from "../kit/registry";
import type { CombatReferenceData } from "../model/data";
import { simulateTeam } from "../simulate";
import type { RelicLoadout, TeamInput } from "../team/input";
import {
  generateIdealRelics,
  type IdealRelicOptions,
  type IdealRelicResult,
} from "./idealRelics";
import { type ObjectiveOptions, TeamObjective } from "./objective";
import type { RelicTables, SetPlan } from "./relics";

export interface AnalysisContext {
  readonly data: CombatReferenceData;
  readonly kits: KitRegistry;
  readonly tables: RelicTables;
  readonly objective?: ObjectiveOptions;
  readonly battle?: Partial<BattleOptions>;
}

/**
 * Substat weights (0–1) from the damage of one more average roll of each
 * substat at a loadout. They feed Relic score profiles, so scoring follows
 * what the team's damage actually rewards.
 */
export function deriveStatWeights(
  objective: TeamObjective,
  tables: RelicTables,
  loadout: RelicLoadout
): Record<string, number> {
  const base = objective.evaluate(loadout);
  const gains: Record<string, number> = {};
  for (const property of tables.substatProperties) {
    const stats = {
      ...loadout.stats,
      [property]:
        (loadout.stats[property] ?? 0) +
        tables.substatRoll(property, "average"),
    };
    gains[property] = Math.max(
      0,
      objective.evaluate({ stats, sets: loadout.sets }) - base
    );
  }
  const best = Math.max(...Object.values(gains), 0);
  return Object.fromEntries(
    Object.entries(gains).map(([property, gain]) => [
      property,
      best > 0 ? Math.round((gain / best) * 100) / 100 : 0,
    ])
  );
}

export interface ComparisonEntry<T> {
  readonly candidate: T;
  readonly damage: number;
  /** Damage relative to the best candidate (1 = best). */
  readonly relative: number;
  readonly ideal: IdealRelicResult;
}

function rank<T>(
  entries: { candidate: T; damage: number; ideal: IdealRelicResult }[]
) {
  const best = Math.max(...entries.map((entry) => entry.damage), 0);
  return entries
    .map((entry) => ({
      ...entry,
      relative: best > 0 ? entry.damage / best : 0,
    }))
    .sort((left, right) => right.damage - left.damage);
}

/**
 * Light Cones for one member, each with its own ideal Relics so the
 * comparison is not biased toward the current build.
 */
export function compareLightCones(
  input: TeamInput,
  slot: number,
  candidates: readonly { id: string; superimposition: number }[],
  context: AnalysisContext,
  relics: Omit<IdealRelicOptions, "mainStats"> &
    Pick<IdealRelicOptions, "mainStats">
): ComparisonEntry<{ id: string; superimposition: number }>[] {
  return rank(
    candidates.map((candidate) => {
      const variant: TeamInput = {
        ...input,
        members: input.members.map((member, index) =>
          index === slot
            ? {
                ...member,
                lightCone: {
                  id: candidate.id,
                  level: 80,
                  superimposition: candidate.superimposition,
                },
              }
            : member
        ),
      };
      const objective = new TeamObjective(
        variant,
        slot,
        context.data,
        context.kits,
        {
          ...context.objective,
          battle: context.battle,
        }
      );
      const ideal = generateIdealRelics(objective, context.tables, relics);
      return { candidate, damage: ideal.damage, ideal };
    })
  );
}

/** Set plans for one member, each with ideal Relics. */
export function compareSetPlans(
  input: TeamInput,
  slot: number,
  plans: readonly SetPlan[],
  context: AnalysisContext,
  relics: Omit<IdealRelicOptions, "plan">
): ComparisonEntry<SetPlan>[] {
  const objective = new TeamObjective(input, slot, context.data, context.kits, {
    ...context.objective,
    battle: context.battle,
  });
  return rank(
    plans.map((plan) => {
      const ideal = generateIdealRelics(objective, context.tables, {
        ...relics,
        plan,
      });
      return { candidate: plan, damage: ideal.damage, ideal };
    })
  );
}

export interface InvestmentStep {
  readonly kind: "eidolon" | "superimposition";
  readonly level: number;
  readonly damage: number;
  /** Damage gained by this step relative to the previous state. */
  readonly gain: number;
}

/**
 * The order in which Eidolons and Superimpositions add the most team damage
 * per copy, starting from the member's current state. Each step is one
 * copy; the member keeps its current Relics.
 */
export function investmentPath(
  input: TeamInput,
  slot: number,
  context: AnalysisContext,
  limits: { maxEidolon?: number; maxSuperimposition?: number } = {}
): { start: number; steps: InvestmentStep[] } {
  const member = input.members[slot];
  if (!member) throw new Error(`No team member in slot ${slot}`);
  const evaluate = (eidolon: number, superimposition: number) => {
    const variant: TeamInput = {
      ...input,
      members: input.members.map((entry, index) =>
        index === slot
          ? {
              ...entry,
              eidolon,
              lightCone: entry.lightCone
                ? { ...entry.lightCone, superimposition }
                : null,
            }
          : entry
      ),
    };
    const result = simulateTeam(variant, context.data, context.kits, {
      critMode: context.objective?.critMode,
      battle: context.battle,
    });
    const target = context.objective?.target ?? "team";
    if (target === "team") return result.report.total;
    return (
      result.report.members.find((entry) => entry.slot === target)?.damage ?? 0
    );
  };
  const maxEidolon = limits.maxEidolon ?? 6;
  const maxSuperimposition = member.lightCone
    ? (limits.maxSuperimposition ?? 5)
    : 0;
  let eidolon = member.eidolon;
  let superimposition = member.lightCone?.superimposition ?? 0;
  const start = evaluate(eidolon, superimposition);
  let current = start;
  const steps: InvestmentStep[] = [];
  while (eidolon < maxEidolon || superimposition < maxSuperimposition) {
    const options: InvestmentStep[] = [];
    if (eidolon < maxEidolon) {
      const damage = evaluate(eidolon + 1, superimposition);
      options.push({
        kind: "eidolon",
        level: eidolon + 1,
        damage,
        gain: damage - current,
      });
    }
    if (member.lightCone && superimposition < maxSuperimposition) {
      const damage = evaluate(eidolon, superimposition + 1);
      options.push({
        kind: "superimposition",
        level: superimposition + 1,
        damage,
        gain: damage - current,
      });
    }
    options.sort((left, right) => right.gain - left.gain);
    const next = options[0];
    if (!next) break;
    steps.push(next);
    current = next.damage;
    if (next.kind === "eidolon") eidolon = next.level;
    else superimposition = next.level;
  }
  return { start, steps };
}
