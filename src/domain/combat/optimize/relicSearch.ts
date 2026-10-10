import type { RelicSlot } from "@/domain/account/schemas";
import type { RelicLoadout } from "../team/input";
import type { StatConstraints } from "./idealRelics";
import type { TeamObjective } from "./objective";
import {
  CAVERN_SLOTS,
  loadoutOf,
  PLANAR_SLOTS,
  RELIC_SLOTS,
  type RelicPiece,
  type RelicTables,
  type SetPlan,
  type SixPieces,
} from "./relics";

export interface RelicSearchOptions {
  readonly pieces: readonly RelicPiece[];
  /** Set plans to consider; default: every plan the inventory can complete. */
  readonly plans?: readonly SetPlan[];
  readonly constraints?: StatConstraints;
  /** Plans searched in depth after the screen. */
  readonly topPlans?: number;
  /** Total objective evaluations allowed. */
  readonly maxEvaluations?: number;
  /** Loadouts returned. */
  readonly keep?: number;
  /** Starting point for marginal weights (default: the best pieces by count). */
  readonly reference?: SixPieces;
}

export interface RelicSearchResult {
  readonly loadouts: readonly {
    readonly pieces: SixPieces;
    readonly loadout: RelicLoadout;
    readonly damage: number;
    readonly plan: SetPlan;
  }[];
  readonly evaluations: number;
  readonly simulations: number;
  readonly plansConsidered: number;
}

/**
 * Damage gained per point of each property near a reference loadout. Used
 * only to rank pieces before exact evaluation.
 */
export function marginalWeights(
  objective: TeamObjective,
  reference: RelicLoadout,
  properties: readonly string[],
  step: (property: string) => number
): Record<string, number> {
  const base = objective.evaluate(reference);
  const weights: Record<string, number> = {};
  for (const property of properties) {
    const delta = step(property);
    if (delta <= 0) continue;
    const stats = {
      ...reference.stats,
      [property]: (reference.stats[property] ?? 0) + delta,
    };
    const gain = objective.evaluate({ stats, sets: reference.sets }) - base;
    weights[property] = Math.max(0, gain / delta);
  }
  return weights;
}

function pieceScore(
  piece: RelicPiece,
  weights: Readonly<Record<string, number>>
): number {
  let score = 0;
  for (const [property, value] of Object.entries(piece.stats)) {
    score += (weights[property] ?? 0) * value;
  }
  return score;
}

function groupBySlot(
  pieces: readonly RelicPiece[]
): Map<RelicSlot, RelicPiece[]> {
  const bySlot = new Map<RelicSlot, RelicPiece[]>(
    RELIC_SLOTS.map((slot) => [slot, []])
  );
  for (const piece of pieces) bySlot.get(piece.slot)?.push(piece);
  return bySlot;
}

/** Plans the inventory can complete: 4-piece Cavern × 2-piece Planar, plus open slots. */
export function inventoryPlans(pieces: readonly RelicPiece[]): SetPlan[] {
  const bySlot = groupBySlot(pieces);
  const has = (slot: RelicSlot, setId: string) =>
    bySlot.get(slot)?.some((piece) => piece.setId === setId) ?? false;
  const cavernSets = new Set(
    pieces
      .filter((piece) => CAVERN_SLOTS.includes(piece.slot))
      .map((piece) => piece.setId)
  );
  const planarSets = new Set(
    pieces
      .filter((piece) => PLANAR_SLOTS.includes(piece.slot))
      .map((piece) => piece.setId)
  );
  const cavern: SetPlan["cavern"][] = [null];
  for (const setId of cavernSets) {
    if (CAVERN_SLOTS.every((slot) => has(slot, setId)))
      cavern.push({ fourPiece: setId });
  }
  const planar: (string | null)[] = [null];
  for (const setId of planarSets) {
    if (PLANAR_SLOTS.every((slot) => has(slot, setId))) planar.push(setId);
  }
  return cavern.flatMap((cavernPlan) =>
    planar.map((planarPlan) => ({ cavern: cavernPlan, planar: planarPlan }))
  );
}

function allowedForPlan(plan: SetPlan, piece: RelicPiece): boolean {
  if (PLANAR_SLOTS.includes(piece.slot)) {
    return plan.planar === null || piece.setId === plan.planar;
  }
  const cavern = plan.cavern;
  if (!cavern) return true;
  if ("fourPiece" in cavern) return piece.setId === cavern.fourPiece;
  return cavern.twoPlusTwo.includes(piece.setId);
}

function satisfies(
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

/** 2+2 plans need two sets of two; check it once a full loadout is chosen. */
function completesPlan(plan: SetPlan, pieces: SixPieces): boolean {
  const cavern = plan.cavern;
  if (!cavern || !("twoPlusTwo" in cavern)) return true;
  const counts = loadoutOf(pieces).sets;
  return cavern.twoPlusTwo.every((setId) => (counts[setId] ?? 0) >= 2);
}

/**
 * Best Relic loadouts for one member from an inventory. Pieces are ranked
 * by marginal weights from the real objective, plans are screened with one
 * exact evaluation each, then each finalist plan is enumerated over its top
 * pieces per slot within the evaluation budget and refined by coordinate
 * ascent over a wider candidate list.
 */
export function searchRelics(
  objective: TeamObjective,
  tables: RelicTables,
  options: RelicSearchOptions
): RelicSearchResult {
  const startEvaluations = objective.evaluations;
  const startSimulations = objective.simulations;
  const maxEvaluations = options.maxEvaluations ?? 40_000;
  const keep = options.keep ?? 5;
  const bySlot = groupBySlot(options.pieces);
  const properties = [
    ...new Set(options.pieces.flatMap((piece) => Object.keys(piece.stats))),
  ];
  const reference: RelicLoadout = options.reference
    ? loadoutOf(options.reference)
    : { stats: {}, sets: {} };
  const weights = marginalWeights(
    objective,
    reference,
    properties,
    (property) =>
      tables.substatProperties.includes(property)
        ? tables.substatRoll(property, "average")
        : (tables.mainStatValue("body", property) ??
            tables.mainStatValue("planarSphere", property) ??
            tables.mainStatValue("linkRope", property) ??
            tables.mainStatValue("feet", property) ??
            0) / 4
  );
  const ranked = new Map<RelicSlot, RelicPiece[]>(
    RELIC_SLOTS.map((slot) => [
      slot,
      [...(bySlot.get(slot) ?? [])].sort(
        (left, right) => pieceScore(right, weights) - pieceScore(left, weights)
      ),
    ])
  );

  const plans = options.plans ?? inventoryPlans(options.pieces);
  const screened = plans
    .map((plan) => {
      const pieces: Partial<Record<RelicSlot, RelicPiece>> = {};
      for (const slot of RELIC_SLOTS) {
        const piece = ranked
          .get(slot)
          ?.find((entry) => allowedForPlan(plan, entry));
        if (piece) pieces[slot] = piece;
      }
      const loadout = loadoutOf(pieces);
      return { plan, pieces, score: objective.evaluate(loadout) };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, options.topPlans ?? 6);

  const results: RelicSearchResult["loadouts"][number][] = [];
  const consider = (pieces: SixPieces, plan: SetPlan) => {
    if (!completesPlan(plan, pieces)) return -1;
    const loadout = loadoutOf(pieces);
    if (!satisfies(objective, loadout, options.constraints)) return -1;
    const damage = objective.evaluate(loadout);
    const key = RELIC_SLOTS.map((slot) => pieces[slot]?.key ?? "").join("|");
    if (
      !results.some(
        (entry) =>
          RELIC_SLOTS.map((slot) => entry.pieces[slot]?.key ?? "").join("|") ===
          key
      )
    ) {
      results.push({ pieces, loadout, damage, plan });
      results.sort((left, right) => right.damage - left.damage);
      if (results.length > keep) results.length = keep;
    }
    return damage;
  };

  const perPlanBudget = Math.max(
    1,
    Math.floor(maxEvaluations / Math.max(1, screened.length))
  );
  for (const { plan } of screened) {
    const candidates = RELIC_SLOTS.map((slot) =>
      (ranked.get(slot) ?? []).filter((piece) => allowedForPlan(plan, piece))
    );
    // Largest per-slot width whose product fits the budget.
    let width = 1;
    while (
      candidates.reduce(
        (product, list) => product * Math.min(list.length || 1, width + 1),
        1
      ) <=
        perPlanBudget * 0.7 &&
      width < 64
    ) {
      width += 1;
    }
    const lists = candidates.map((list) => list.slice(0, Math.max(1, width)));
    const chosen: Partial<Record<RelicSlot, RelicPiece>> = {};
    const enumerate = (index: number) => {
      if (index === RELIC_SLOTS.length) {
        consider({ ...chosen }, plan);
        return;
      }
      const slot = RELIC_SLOTS[index];
      const list = lists[index];
      if (!slot || !list || list.length === 0) {
        enumerate(index + 1);
        return;
      }
      for (const piece of list) {
        chosen[slot] = piece;
        enumerate(index + 1);
      }
      delete chosen[slot];
    };
    enumerate(0);

    // Coordinate ascent from the best enumerated loadout of this plan.
    const best = results.find((entry) => entry.plan === plan);
    if (!best) continue;
    let current: Partial<Record<RelicSlot, RelicPiece>> = { ...best.pieces };
    let currentDamage = best.damage;
    const wide = candidates.map((list) => list.slice(0, 40));
    for (let pass = 0; pass < 4; pass += 1) {
      let improved = false;
      RELIC_SLOTS.forEach((slot, index) => {
        for (const piece of wide[index] ?? []) {
          if (current[slot]?.key === piece.key) continue;
          const trial = { ...current, [slot]: piece };
          const damage = consider(trial, plan);
          if (damage > currentDamage + 1e-9) {
            current = trial;
            currentDamage = damage;
            improved = true;
          }
        }
      });
      if (!improved) break;
    }
  }

  return {
    loadouts: results,
    evaluations: objective.evaluations - startEvaluations,
    simulations: objective.simulations - startSimulations,
    plansConsidered: plans.length,
  };
}
