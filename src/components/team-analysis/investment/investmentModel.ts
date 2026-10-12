import type { InvestmentStep } from "@/domain/combat/optimize/analysis";

/** Eidolon and Superimposition of one member (no Superimposition without a Light Cone). */
export interface CopyState {
  readonly eidolon: number;
  readonly superimposition: number | null;
}

/** Highest Eidolon and Superimposition a member's path may reach. */
export interface InvestmentLimits {
  readonly eidolon: number;
  readonly superimposition: number;
}

export const DEFAULT_LIMITS: InvestmentLimits = {
  eidolon: 6,
  superimposition: 5,
};

/** One member's finished path, as returned by its investment job. */
export interface MemberPath {
  readonly slot: number;
  readonly characterId: string;
  readonly combatTypeId: string | null;
  readonly lightConeId: string | null;
  /** The member's state when the run started. */
  readonly from: CopyState;
  /** Team damage before any copy. */
  readonly start: number;
  readonly steps: readonly InvestmentStep[];
}

/** A point on a member's path: `copies` copies bought from the start state. */
export interface PathPoint {
  readonly copies: number;
  readonly state: CopyState;
  readonly damage: number;
  /** Team damage as a percentage of the start (100 = start). */
  readonly percent: number;
  /** Change against the previous point, as a fraction (null for the start). */
  readonly vsPrevious: number | null;
  /** The copy bought to reach this point (null for the start). */
  readonly step: {
    readonly kind: InvestmentStep["kind"];
    readonly fromLevel: number;
    readonly toLevel: number;
  } | null;
}

/** Every point of a member's path, the start state first. */
export function pathPoints(path: MemberPath): PathPoint[] {
  const start = path.start;
  const percent = (damage: number) =>
    start > 0 ? (damage / start) * 100 : 100;
  let state: CopyState = path.from;
  let previous = start;
  const points: PathPoint[] = [
    {
      copies: 0,
      state,
      damage: start,
      percent: 100,
      vsPrevious: null,
      step: null,
    },
  ];
  path.steps.forEach((step, index) => {
    const fromLevel =
      step.kind === "eidolon" ? state.eidolon : (state.superimposition ?? 0);
    state =
      step.kind === "eidolon"
        ? { ...state, eidolon: step.level }
        : { ...state, superimposition: step.level };
    points.push({
      copies: index + 1,
      state,
      damage: step.damage,
      percent: percent(step.damage),
      vsPrevious: previous > 0 ? step.damage / previous - 1 : null,
      step: { kind: step.kind, fromLevel, toLevel: step.level },
    });
    previous = step.damage;
  });
  return points;
}

/** One member's next copy at a point of the combined order. */
export interface OrderCandidate {
  readonly slot: number;
  readonly characterId: string;
  readonly kind: InvestmentStep["kind"];
  readonly level: number;
  /** Team damage gained by this copy, as a fraction of the start. */
  readonly gain: number;
}

export interface OrderRow {
  /** Copies bought after this row (1-based). */
  readonly copies: number;
  /** Every member's next copy at this point, in team order. */
  readonly candidates: readonly OrderCandidate[];
  /** Index into `candidates` of the copy taken (the largest gain). */
  readonly chosen: number;
  /** Projected team damage after this row, as a percentage of the start. */
  readonly percent: number;
}

/**
 * Merges the members' paths into one purchase order: each row takes the
 * member whose next copy gains the most. Members are treated as independent,
 * so the cumulative total is a projection.
 */
export function combinedOrder(paths: readonly MemberPath[]): OrderRow[] {
  const queues = paths.map((path) => ({
    path,
    candidates: path.steps.map(
      (step): OrderCandidate => ({
        slot: path.slot,
        characterId: path.characterId,
        kind: step.kind,
        level: step.level,
        gain: path.start > 0 ? step.gain / path.start : 0,
      })
    ),
    next: 0,
  }));
  const rows: OrderRow[] = [];
  let percent = 100;
  for (;;) {
    const open = queues.filter((queue) => queue.next < queue.candidates.length);
    if (!open.length) break;
    const candidates = open.map(
      (queue) => queue.candidates[queue.next] as OrderCandidate
    );
    let chosen = 0;
    candidates.forEach((candidate, index) => {
      if (candidate.gain > (candidates[chosen]?.gain ?? -Infinity))
        chosen = index;
    });
    const queue = open[chosen];
    const pick = candidates[chosen];
    if (!queue || !pick) break;
    queue.next += 1;
    percent += pick.gain * 100;
    rows.push({ copies: rows.length + 1, candidates, chosen, percent });
  }
  return rows;
}

/**
 * Y-axis ticks (percentages) covering the data: the smallest step from
 * 5 / 10 / 20 / 25 / 50 / 100 that needs at most six intervals.
 */
export function percentTicks(values: readonly number[]): number[] {
  const low = Math.min(100, ...values);
  const high = Math.max(100, ...values);
  const steps = [5, 10, 20, 25, 50, 100, 200, 500];
  let step = steps[steps.length - 1] as number;
  for (const candidate of steps) {
    const min = Math.floor(low / candidate) * candidate;
    const max = Math.max(
      min + candidate,
      Math.ceil(high / candidate) * candidate
    );
    if ((max - min) / candidate <= 6) {
      step = candidate;
      break;
    }
  }
  const min = Math.floor(low / step) * step;
  let max = Math.ceil(high / step) * step;
  if (max === min) max = min + step;
  if (max - high < step * 0.15 && high > 100) max += step;
  const ticks: number[] = [];
  for (let value = min; value <= max + 1e-9; value += step) ticks.push(value);
  return ticks;
}

/** Stroke dash patterns that tell apart members sharing a Combat Type. */
const DASHES = [undefined, "6 3", "2 3", "8 3 2 3"] as const;

/** A dash pattern per slot: solid for the first member of each Combat Type. */
export function dashPatterns(
  members: readonly { slot: number; combatTypeId: string | null }[]
): Map<number, string | undefined> {
  const seen = new Map<string, number>();
  const result = new Map<number, string | undefined>();
  for (const member of members) {
    const key = member.combatTypeId ?? `slot:${member.slot}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    result.set(member.slot, DASHES[index % DASHES.length]);
  }
  return result;
}
