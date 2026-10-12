import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberJobStatus } from "@/components/team-analysis/team/MemberProgress";
import {
  cancelCombatJobs,
  isCombatJobCancelled,
} from "@/services/combat/client";
import type { SimulateResponse } from "@/services/combat/jobs";
import {
  readCachedResult,
  writeCachedResult,
} from "@/services/combat/resultCache";

export interface MemberRunEntry<T> {
  readonly status: MemberJobStatus;
  readonly result: T | null;
}

/** One analysis run over every filled member, then an optional team step. */
export interface AnalysisRunState<T> {
  /** By team slot, in run order. */
  readonly entries: ReadonlyMap<number, MemberRunEntry<T>>;
  /** The team simulated with every member's result applied. */
  readonly combined: SimulateResponse | null;
  /** The slot being computed, or "team" during the combined step. */
  readonly active: number | "team" | null;
  readonly finished: boolean;
}

interface AnalysisRunOptions<T> {
  /** Identifies the inputs; a different key shows that key's result. */
  readonly key: string;
  readonly slots: readonly number[];
  /** One member's job; `previous` holds the members finished before it. */
  readonly runMember: (
    slot: number,
    previous: ReadonlyMap<number, T>
  ) => Promise<T>;
  /** Simulates the team with the members' results (Optimize only). */
  readonly combine?: (
    results: ReadonlyMap<number, T>
  ) => Promise<SimulateResponse | null>;
}

interface LiveRun<T> {
  readonly key: string;
  readonly state: AnalysisRunState<T>;
  readonly running: boolean;
}

function initialState<T>(slots: readonly number[]): AnalysisRunState<T> {
  return {
    entries: new Map(
      slots.map((slot) => [slot, { status: "pending", result: null }])
    ),
    combined: null,
    active: null,
    finished: false,
  };
}

/**
 * Runs an analysis one member at a time on the analysis lane, so progress can
 * be shown per member. Finished runs are cached in memory for the session;
 * changing any input shows the cached run for the new inputs, if any.
 */
export function useAnalysisRun<T>({
  key,
  slots,
  runMember,
  combine,
}: AnalysisRunOptions<T>) {
  const [live, setLive] = useState<LiveRun<T> | null>(null);
  const runId = useRef(0);
  const runningRef = useRef(false);

  useEffect(
    () => () => {
      runId.current += 1;
      if (runningRef.current) cancelCombatJobs("analysis");
    },
    []
  );

  const run = useCallback(async () => {
    const id = runId.current + 1;
    runId.current = id;
    runningRef.current = true;
    let state = initialState<T>(slots);
    const publish = (next: AnalysisRunState<T>, running: boolean) => {
      state = next;
      if (runId.current === id) setLive({ key, state, running });
    };
    publish(state, true);
    const results = new Map<number, T>();
    for (const slot of slots) {
      if (runId.current !== id) return;
      const entries = new Map(state.entries);
      entries.set(slot, { status: "running", result: null });
      publish({ ...state, entries, active: slot }, true);
      try {
        const result = await runMember(slot, new Map(results));
        if (runId.current !== id) return;
        results.set(slot, result);
        const done = new Map(state.entries);
        done.set(slot, { status: "done", result });
        publish({ ...state, entries: done }, true);
      } catch (error) {
        if (runId.current !== id || isCombatJobCancelled(error)) return;
        const failed = new Map(state.entries);
        failed.set(slot, { status: "failed", result: null });
        publish({ ...state, entries: failed }, true);
      }
    }
    let combined: SimulateResponse | null = null;
    if (combine && results.size > 0) {
      publish({ ...state, active: "team" }, true);
      try {
        combined = await combine(results);
      } catch (error) {
        if (runId.current !== id || isCombatJobCancelled(error)) return;
      }
      if (runId.current !== id) return;
    }
    const finished: AnalysisRunState<T> = {
      ...state,
      combined,
      active: null,
      finished: true,
    };
    writeCachedResult(key, finished);
    runningRef.current = false;
    publish(finished, false);
  }, [key, slots, runMember, combine]);

  const stop = useCallback(() => {
    runId.current += 1;
    runningRef.current = false;
    cancelCombatJobs("analysis");
    setLive((current) =>
      current ? { ...current, running: false, state: current.state } : current
    );
  }, []);

  const shown =
    live && live.key === key
      ? live
      : (() => {
          const cached = readCachedResult<AnalysisRunState<T>>(key);
          return cached ? { key, state: cached, running: false } : null;
        })();

  return {
    /** The run for the current inputs (live, stopped part-way, or cached). */
    state: shown?.state ?? null,
    /** The run in progress, even if the inputs changed since it started. */
    progress: live?.running ? live.state : null,
    running: Boolean(live?.running),
    run,
    stop,
  };
}
