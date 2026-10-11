import { betaEnabled } from "@/data/betaState";
import type { CombatCatalog } from "./jobs";
import type { CombatJob, CombatJobMessage, CombatJobResult } from "./runJob";

/**
 * Interactive jobs (re-simulation) and analysis jobs (optimize, ideal,
 * compare, investment) run on separate workers, so a long analysis never
 * delays the automatic simulation.
 */
export type CombatLane = "interactive" | "analysis";

/** Rejection reason for jobs stopped by {@link cancelCombatJobs}. */
export class CombatJobCancelled extends Error {
  constructor() {
    super("Combat job cancelled");
    this.name = "CombatJobCancelled";
  }
}

export function isCombatJobCancelled(
  error: unknown
): error is CombatJobCancelled {
  return error instanceof CombatJobCancelled;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface LaneState {
  worker: Worker | null;
  readonly pending: Map<number, Pending>;
}

const lanes: Record<CombatLane, LaneState> = {
  interactive: { worker: null, pending: new Map() },
  analysis: { worker: null, pending: new Map() },
};
let nextId = 1;
let inlineCatalog: Promise<CombatCatalog> | null = null;

/** The lane a job runs on unless the caller chooses one. */
export function defaultLane(kind: CombatJob["kind"]): CombatLane {
  return kind === "simulate" ? "interactive" : "analysis";
}

function workerInstance(lane: CombatLane): Worker | null {
  if (typeof Worker === "undefined") return null;
  const state = lanes[lane];
  if (!state.worker) {
    const worker = new Worker(new URL("./combat.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      event: MessageEvent<{ id: number; result?: unknown; error?: string }>
    ) => {
      const entry = state.pending.get(event.data.id);
      if (!entry) return;
      state.pending.delete(event.data.id);
      if (event.data.error !== undefined)
        entry.reject(new Error(event.data.error));
      else entry.resolve(event.data.result);
    };
    state.worker = worker;
  }
  return state.worker;
}

/**
 * Run a combat job off the main thread. Environments without workers (tests)
 * run the same job inline.
 */
export async function runCombatJob<K extends CombatJob["kind"]>(
  job: Extract<CombatJob, { kind: K }>,
  lane: CombatLane = defaultLane(job.kind)
): Promise<CombatJobResult<K>> {
  const target = workerInstance(lane);
  if (!target) {
    const [{ loadCombatCatalog }, { runJob }] = await Promise.all([
      import("./jobs"),
      import("./runJob"),
    ]);
    inlineCatalog ??= loadCombatCatalog();
    return runJob(await inlineCatalog, job);
  }
  const id = nextId;
  nextId += 1;
  const { pending } = lanes[lane];
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    const message: CombatJobMessage = { id, job, beta: betaEnabled() };
    target.postMessage(message);
  });
}

/**
 * Stop every job on a lane: its worker is terminated and pending jobs reject
 * with {@link CombatJobCancelled}. The next job starts a fresh worker. Jobs
 * that run inline (tests) cannot be interrupted, so this is a no-op there.
 */
export function cancelCombatJobs(lane: CombatLane = "analysis"): void {
  const state = lanes[lane];
  if (!state.worker) return;
  state.worker.terminate();
  state.worker = null;
  const entries = [...state.pending.values()];
  state.pending.clear();
  for (const entry of entries) entry.reject(new CombatJobCancelled());
}
