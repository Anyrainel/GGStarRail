import type { RelicSlot } from "@/domain/account/schemas";
import { FIXED_MAIN_STAT } from "@/domain/stats";
import type { RelicLoadout } from "../team/input";
import type { TeamObjective } from "./objective";
import {
  planSets,
  RELIC_SLOTS,
  type RelicPiece,
  type RelicTables,
  type RollQuality,
  type SetPlan,
  type SixPieces,
} from "./relics";

export type ConfigurableSlot = "body" | "feet" | "planarSphere" | "linkRope";
export const CONFIGURABLE_SLOTS: readonly ConfigurableSlot[] = [
  "body",
  "feet",
  "planarSphere",
  "linkRope",
];

/** Substat budgets: 48 is a realistic endgame build, 54 a perfect one. */
export const SUBSTAT_BUDGETS = {
  realistic: { rolls: 48, quality: "average" },
  perfect: { rolls: 54, quality: "high" },
} as const satisfies Record<string, { rolls: number; quality: RollQuality }>;

export type SubstatBudget = keyof typeof SUBSTAT_BUDGETS;

export interface StatConstraints {
  /** Minimum final SPD of the member (e.g. a cycle breakpoint). */
  readonly minSpeed?: number;
  readonly minEnergyRegen?: number;
}

export interface IdealRelicOptions {
  readonly plan: SetPlan;
  readonly budget?: SubstatBudget;
  /** Allowed main stats per configurable slot (default: every option). */
  readonly mainStats?: Partial<Record<ConfigurableSlot, readonly string[]>>;
  readonly constraints?: StatConstraints;
  /** Main-stat combinations kept after the cheap screen. */
  readonly finalists?: number;
}

export interface IdealRelicResult {
  readonly pieces: SixPieces;
  readonly loadout: RelicLoadout;
  readonly damage: number;
  readonly mainStats: Readonly<Record<RelicSlot, string>>;
  /** Substat rolls by property across the six pieces. */
  readonly rolls: Readonly<Record<string, number>>;
  readonly feasible: boolean;
}

const LINES_PER_PIECE = 4;
const MAX_ROLLS_PER_LINE = 6;
const SPEED = "SpeedDelta";
const ENERGY_REGEN_PROPERTY = "SPRatioBase";

function setForSlot(plan: SetPlan, slot: RelicSlot): string {
  if (slot === "planarSphere" || slot === "linkRope") return plan.planar ?? "";
  const cavern = plan.cavern;
  if (!cavern) return "";
  if ("fourPiece" in cavern) return cavern.fourPiece;
  return slot === "head" || slot === "hands"
    ? cavern.twoPlusTwo[0]
    : cavern.twoPlusTwo[1];
}

function mainStatsOf(
  chosen: Readonly<Record<ConfigurableSlot, string>>
): Record<RelicSlot, string> {
  return {
    head: FIXED_MAIN_STAT.head,
    hands: FIXED_MAIN_STAT.hands,
    ...chosen,
  } as Record<RelicSlot, string>;
}

/** Totals for main stats plus substat rolls, as a loadout. */
function buildLoadout(
  tables: RelicTables,
  plan: SetPlan,
  mains: Readonly<Record<RelicSlot, string>>,
  rolls: Readonly<Record<string, number>>,
  quality: RollQuality
): RelicLoadout {
  const stats: Record<string, number> = {};
  for (const slot of RELIC_SLOTS) {
    const property = mains[slot];
    const value = tables.mainStatValue(slot, property) ?? 0;
    stats[property] = (stats[property] ?? 0) + value;
  }
  for (const [property, count] of Object.entries(rolls)) {
    if (count <= 0) continue;
    stats[property] =
      (stats[property] ?? 0) + count * tables.substatRoll(property, quality);
  }
  // Sets come from the plan; unassigned slots carry no set bonus.
  const sets = planSets(plan);
  return { stats, sets };
}

/** Pieces whose main stat differs from a substat can carry it. */
function eligiblePieces(
  mains: Readonly<Record<RelicSlot, string>>,
  property: string
): number {
  return RELIC_SLOTS.filter((slot) => mains[slot] !== property).length;
}

function linesUsed(rolls: Readonly<Record<string, number>>): number {
  let lines = 0;
  for (const count of Object.values(rolls)) {
    if (count > 0) lines += Math.ceil(count / MAX_ROLLS_PER_LINE);
  }
  return lines;
}

/**
 * Whether `rolls` fits six pieces: per-stat caps, at most 24 lines, and the
 * unused lines' mandatory filler roll counted against the budget.
 */
function feasible(
  mains: Readonly<Record<RelicSlot, string>>,
  rolls: Readonly<Record<string, number>>,
  budget: number
): boolean {
  let total = 0;
  for (const [property, count] of Object.entries(rolls)) {
    if (count <= 0) continue;
    if (count > eligiblePieces(mains, property) * MAX_ROLLS_PER_LINE)
      return false;
    total += count;
  }
  const lines = linesUsed(rolls);
  const maxLines = RELIC_SLOTS.length * LINES_PER_PIECE;
  if (lines > maxLines) return false;
  return total + (maxLines - lines) <= budget;
}

function meetsConstraints(
  objective: TeamObjective,
  loadout: RelicLoadout,
  constraints: StatConstraints | undefined
): boolean {
  if (!constraints) return true;
  const panel = objective.memberPanel(loadout);
  if (
    constraints.minSpeed !== undefined &&
    panel.speed + 1e-9 < constraints.minSpeed
  ) {
    return false;
  }
  if (
    constraints.minEnergyRegen !== undefined &&
    panel.energyRegen + 1e-9 < constraints.minEnergyRegen
  ) {
    return false;
  }
  return true;
}

/**
 * Allocate substat rolls one at a time to the property with the largest
 * marginal damage, under real Relic rules. Constraint stats (SPD/ERR
 * minimums) are satisfied first.
 */
export function allocateSubstats(
  objective: TeamObjective,
  tables: RelicTables,
  plan: SetPlan,
  mains: Readonly<Record<RelicSlot, string>>,
  budget: SubstatBudget,
  constraints?: StatConstraints,
  rollLimit?: number
): { rolls: Record<string, number>; damage: number; feasible: boolean } {
  const { rolls: maxRolls, quality } = SUBSTAT_BUDGETS[budget];
  const limit = rollLimit ?? maxRolls;
  const rolls: Record<string, number> = {};
  const total = () =>
    Object.values(rolls).reduce((sum, count) => sum + count, 0);
  const evaluate = () =>
    objective.evaluate(buildLoadout(tables, plan, mains, rolls, quality));
  const canAdd = (property: string) => {
    const next = { ...rolls, [property]: (rolls[property] ?? 0) + 1 };
    return feasible(mains, next, maxRolls) && total() < limit;
  };

  // Satisfy minimums first with the fewest rolls.
  const prefill = (property: string, satisfied: () => boolean) => {
    while (!satisfied() && canAdd(property)) {
      rolls[property] = (rolls[property] ?? 0) + 1;
    }
  };
  if (constraints?.minSpeed !== undefined) {
    prefill(SPEED, () =>
      meetsConstraints(
        objective,
        buildLoadout(tables, plan, mains, rolls, quality),
        {
          minSpeed: constraints.minSpeed,
        }
      )
    );
  }
  const constraintMet = meetsConstraints(
    objective,
    buildLoadout(tables, plan, mains, rolls, quality),
    constraints
  );

  let current = evaluate();
  while (total() < limit) {
    let bestProperty: string | null = null;
    let bestDamage = current;
    for (const property of tables.substatProperties) {
      if (!canAdd(property)) continue;
      rolls[property] = (rolls[property] ?? 0) + 1;
      const damage = evaluate();
      rolls[property] -= 1;
      if (damage > bestDamage + 1e-9) {
        bestDamage = damage;
        bestProperty = property;
      }
    }
    if (!bestProperty) break;
    rolls[bestProperty] = (rolls[bestProperty] ?? 0) + 1;
    current = bestDamage;
  }
  return { rolls, damage: current, feasible: constraintMet };
}

/** Distribute rolls into six concrete pieces (four lines each) for display. */
export function packPieces(
  tables: RelicTables,
  plan: SetPlan,
  mains: Readonly<Record<RelicSlot, string>>,
  rolls: Readonly<Record<string, number>>,
  quality: RollQuality
): SixPieces {
  const lines = new Map<RelicSlot, Map<string, number>>(
    RELIC_SLOTS.map((slot) => [slot, new Map()])
  );
  const ordered = Object.entries(rolls)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  for (const [property, count] of ordered) {
    let remaining = count;
    const slots = RELIC_SLOTS.filter((slot) => mains[slot] !== property).sort(
      (left, right) =>
        (lines.get(left)?.size ?? 0) - (lines.get(right)?.size ?? 0)
    );
    for (const slot of slots) {
      if (remaining <= 0) break;
      const pieceLines = lines.get(slot);
      if (!pieceLines || pieceLines.size >= LINES_PER_PIECE) continue;
      const take = Math.min(MAX_ROLLS_PER_LINE, remaining);
      pieceLines.set(property, take);
      remaining -= take;
    }
  }
  const pieces: Partial<Record<RelicSlot, RelicPiece>> = {};
  for (const slot of RELIC_SLOTS) {
    const property = mains[slot];
    const stats: Record<string, number> = {
      [property]: tables.mainStatValue(slot, property) ?? 0,
    };
    for (const [substat, count] of lines.get(slot) ?? []) {
      stats[substat] =
        (stats[substat] ?? 0) + count * tables.substatRoll(substat, quality);
    }
    pieces[slot] = {
      key: `ideal:${slot}`,
      slot,
      setId: setForSlot(plan, slot),
      mainStat: property,
      stats,
    };
  }
  return pieces;
}

function combinations(
  options: Readonly<Record<ConfigurableSlot, readonly string[]>>
): Record<ConfigurableSlot, string>[] {
  let result: Record<ConfigurableSlot, string>[] = [
    {} as Record<ConfigurableSlot, string>,
  ];
  for (const slot of CONFIGURABLE_SLOTS) {
    const next: Record<ConfigurableSlot, string>[] = [];
    for (const partial of result) {
      for (const option of options[slot])
        next.push({ ...partial, [slot]: option });
    }
    result = next;
  }
  return result;
}

/**
 * Ideal Relics for one member under a set plan: prune main stats slot by
 * slot, screen the remaining combinations with a short greedy allocation,
 * then allocate the full substat budget for the finalists.
 */
export function generateIdealRelics(
  objective: TeamObjective,
  tables: RelicTables,
  options: IdealRelicOptions
): IdealRelicResult {
  const budget = options.budget ?? "realistic";
  const { quality } = SUBSTAT_BUDGETS[budget];
  const allowed = Object.fromEntries(
    CONFIGURABLE_SLOTS.map((slot) => [
      slot,
      options.mainStats?.[slot]?.length
        ? options.mainStats[slot]
        : tables.mainStatOptions(slot),
    ])
  ) as Record<ConfigurableSlot, readonly string[]>;

  // 1. Slot-by-slot pruning around a neutral reference.
  const reference = Object.fromEntries(
    CONFIGURABLE_SLOTS.map((slot) => [slot, allowed[slot][0] ?? ""])
  ) as Record<ConfigurableSlot, string>;
  const pruned = {} as Record<ConfigurableSlot, string[]>;
  for (const slot of CONFIGURABLE_SLOTS) {
    const scored = allowed[slot].map((property) => {
      const mains = mainStatsOf({ ...reference, [slot]: property });
      return {
        property,
        damage: objective.evaluate(
          buildLoadout(tables, options.plan, mains, {}, quality)
        ),
      };
    });
    scored.sort((left, right) => right.damage - left.damage);
    const keep = scored.slice(0, 3).map((entry) => entry.property);
    // Keep SPD boots available whenever a SPD minimum exists.
    if (
      slot === "feet" &&
      options.constraints?.minSpeed !== undefined &&
      allowed.feet.includes(SPEED) &&
      !keep.includes(SPEED)
    ) {
      keep.push(SPEED);
    }
    if (
      slot === "linkRope" &&
      options.constraints?.minEnergyRegen !== undefined &&
      allowed.linkRope.includes(ENERGY_REGEN_PROPERTY) &&
      !keep.includes(ENERGY_REGEN_PROPERTY)
    ) {
      keep.push(ENERGY_REGEN_PROPERTY);
    }
    pruned[slot] = keep;
  }

  // 2. Screen combinations with a short allocation.
  const screened = combinations(pruned).map((chosen) => {
    const mains = mainStatsOf(chosen);
    const result = allocateSubstats(
      objective,
      tables,
      options.plan,
      mains,
      budget,
      options.constraints,
      12
    );
    return { mains, damage: result.feasible ? result.damage : -1 };
  });
  screened.sort((left, right) => right.damage - left.damage);

  // 3. Full allocation for the finalists.
  let best: IdealRelicResult | null = null;
  for (const candidate of screened.slice(0, options.finalists ?? 4)) {
    const result = allocateSubstats(
      objective,
      tables,
      options.plan,
      candidate.mains,
      budget,
      options.constraints
    );
    const score = result.feasible ? result.damage : -1;
    if (!best || score > (best.feasible ? best.damage : -1)) {
      const pieces = packPieces(
        tables,
        options.plan,
        candidate.mains,
        result.rolls,
        quality
      );
      best = {
        pieces,
        loadout: buildLoadout(
          tables,
          options.plan,
          candidate.mains,
          result.rolls,
          quality
        ),
        damage: result.damage,
        mainStats: candidate.mains,
        rolls: result.rolls,
        feasible: result.feasible,
      };
    }
  }
  if (!best) throw new Error("No main-stat combination to evaluate");
  return best;
}
