import { betaEnabled } from "@/data/betaState";
import type { CombatCatalog } from "./jobs";
import type { CombatJob, CombatJobMessage, CombatJobResult } from "./runJob";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let inlineCatalog: Promise<CombatCatalog> | null = null;

function workerInstance(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./combat.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      event: MessageEvent<{ id: number; result?: unknown; error?: string }>
    ) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.error !== undefined)
        entry.reject(new Error(event.data.error));
      else entry.resolve(event.data.result);
    };
  }
  return worker;
}

/**
 * Run a combat job off the main thread. Environments without workers (tests)
 * run the same job inline.
 */
export async function runCombatJob<K extends CombatJob["kind"]>(
  job: Extract<CombatJob, { kind: K }>
): Promise<CombatJobResult<K>> {
  const target = workerInstance();
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
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    const message: CombatJobMessage = { id, job, beta: betaEnabled() };
    target.postMessage(message);
  });
}
