/// <reference lib="webworker" />
import { STORAGE_KEYS } from "@/config/identity";
import type { CombatCatalog } from "./jobs";
import type { CombatJob, CombatJobMessage } from "./runJob";

let catalog: Promise<CombatCatalog> | null = null;

/**
 * Workers have no localStorage. The catalog loader only reads the beta flag,
 * which the page sends with every job so both sides load the same entities.
 */
function installStorageShim(beta: boolean) {
  const store: Record<string, string> = { [STORAGE_KEYS.beta]: String(beta) };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: () => undefined,
    },
  });
}

self.onmessage = async (event: MessageEvent<CombatJobMessage>) => {
  const { id, job, beta } = event.data;
  try {
    if (!catalog) {
      installStorageShim(beta);
      const jobs = await import("./jobs");
      catalog = jobs.loadCombatCatalog();
    }
    const loaded = await catalog;
    const { runJob } = await import("./runJob");
    const result = runJob(loaded, job as CombatJob);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
