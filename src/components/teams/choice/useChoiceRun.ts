import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MemberJobStatus } from "@/components/teams/team/MemberProgress";
import type {
  StatConstraints,
  SubstatBudget,
} from "@/domain/combat/optimize/idealRelics";
import type { TeamPlan } from "@/domain/team/schemas";
import {
  cancelCombatJobs,
  isCombatJobCancelled,
  runCombatJob,
} from "@/services/combat/client";
import type { CompareEntry, WorkspaceSources } from "@/services/combat/jobs";
import {
  readCachedResult,
  resultCacheKey,
  writeCachedResult,
} from "@/services/combat/resultCache";
import {
  CHOICE_MODES,
  type ChoiceMode,
  type ChoiceResult,
} from "./choiceModel";

/** A filled team slot as a run compares it. */
export interface ChoiceMember {
  readonly slot: number;
  readonly characterId: string;
  readonly constraints?: StatConstraints;
}

/** The run in progress or the last one started on this page. */
export interface ChoiceRun {
  readonly mode: ChoiceMode;
  /** The ranking key of each member the run compares, as it started. */
  readonly keys: ReadonlyMap<number, string>;
  readonly result: ChoiceResult;
  /** Job status by slot. */
  readonly status: ReadonlyMap<number, MemberJobStatus>;
  /** The slot being compared. */
  readonly active: number | null;
  readonly running: boolean;
}

const EMPTY_RESULT: ChoiceResult = { rankings: {}, failed: [] };

/**
 * One member's ranking depends on the team, the workspace, the budget and
 * that member's own stat floors; the compare job keeps every other member
 * as it is.
 */
function memberCacheKey(
  mode: ChoiceMode,
  team: TeamPlan,
  sources: WorkspaceSources,
  member: ChoiceMember,
  budget: SubstatBudget
): string {
  return resultCacheKey("choice", mode, team, sources, {
    budget,
    slot: member.slot,
    constraints: member.constraints ?? null,
  });
}

function memberKeys(
  mode: ChoiceMode,
  team: TeamPlan,
  sources: WorkspaceSources,
  members: readonly ChoiceMember[],
  budget: SubstatBudget
): ReadonlyMap<number, string> {
  return new Map(
    members.map((member) => [
      member.slot,
      memberCacheKey(mode, team, sources, member, budget),
    ])
  );
}

/**
 * Compares Light Cones or set plans one member at a time on the analysis
 * lane; each member's ranking appears as soon as its job finishes and is
 * kept in memory for the session under that member's own inputs.
 */
export function useChoiceRun(
  team: TeamPlan,
  sources: WorkspaceSources,
  members: readonly ChoiceMember[],
  budget: SubstatBudget
) {
  const [live, setLive] = useState<ChoiceRun | null>(null);
  const runId = useRef(0);
  const runningRef = useRef(false);
  const latest = useRef({ team, sources, members, budget });
  latest.current = { team, sources, members, budget };

  const run = useCallback((mode: ChoiceMode) => {
    const { team, sources, budget } = latest.current;
    if (!latest.current.members.length) return;
    // Members that already have a ranking for their current inputs keep it;
    // with every ranking in place, the run compares everyone again.
    const missing = latest.current.members.filter(
      (member) =>
        readCachedResult(
          memberCacheKey(mode, team, sources, member, budget)
        ) === undefined
    );
    const members = missing.length ? missing : latest.current.members;
    const id = runId.current + 1;
    runId.current = id;
    runningRef.current = true;
    const keys = memberKeys(mode, team, sources, members, budget);
    let state: ChoiceRun = {
      mode,
      keys,
      result: EMPTY_RESULT,
      status: new Map(members.map((member) => [member.slot, "pending"])),
      active: null,
      running: true,
    };
    const publish = (next: ChoiceRun) => {
      state = next;
      if (runId.current === id) setLive(next);
    };
    const withStatus = (slot: number, status: MemberJobStatus) =>
      new Map(state.status).set(slot, status);
    publish(state);

    void (async () => {
      for (const member of members) {
        if (runId.current !== id) return;
        publish({
          ...state,
          status: withStatus(member.slot, "running"),
          active: member.slot,
        });
        try {
          const entries = await runCombatJob({
            kind: "compare",
            request: {
              team,
              sources,
              slot: member.slot,
              kind: mode,
              budget,
              constraints: member.constraints,
            },
          });
          if (runId.current !== id) return;
          const key = keys.get(member.slot);
          if (key) writeCachedResult(key, entries);
          publish({
            ...state,
            result: {
              ...state.result,
              rankings: { ...state.result.rankings, [member.slot]: entries },
            },
            status: withStatus(member.slot, "done"),
          });
        } catch (error) {
          if (runId.current !== id) return;
          if (isCombatJobCancelled(error)) {
            // Stopped from elsewhere: keep what finished.
            runningRef.current = false;
            publish({ ...state, active: null, running: false });
            return;
          }
          publish({
            ...state,
            result: {
              ...state.result,
              failed: [...state.result.failed, member.slot],
            },
            status: withStatus(member.slot, "failed"),
          });
        }
      }
      if (runId.current !== id) return;
      runningRef.current = false;
      publish({ ...state, active: null, running: false });
    })();
  }, []);

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    runId.current += 1;
    runningRef.current = false;
    cancelCombatJobs("analysis");
    setLive((current) =>
      current
        ? {
            ...current,
            active: null,
            running: false,
            status: new Map(
              [...current.status].map(([slot, value]) => [
                slot,
                value === "running" ? "pending" : value,
              ])
            ),
          }
        : current
    );
  }, []);

  // Leaving the page stops its jobs.
  useEffect(
    () => () => {
      if (runningRef.current) {
        runId.current += 1;
        runningRef.current = false;
        cancelCombatJobs("analysis");
      }
    },
    []
  );

  /** Each member's ranking key for the current inputs, per mode. */
  const keys = useMemo(
    () =>
      Object.fromEntries(
        CHOICE_MODES.map((mode) => [
          mode,
          memberKeys(mode, team, sources, members, budget),
        ])
      ) as Record<ChoiceMode, ReadonlyMap<number, string>>,
    [team, sources, members, budget]
  );

  /** Whether the live run compared this member with its current inputs. */
  const liveFor = (mode: ChoiceMode, slot: number): ChoiceRun | null =>
    live &&
    live.mode === mode &&
    live.keys.get(slot) !== undefined &&
    live.keys.get(slot) === keys[mode].get(slot)
      ? live
      : null;

  /**
   * The rankings for the current inputs, member by member: from the live
   * run (also when stopped part-way) or from an earlier run.
   */
  const resultFor = (mode: ChoiceMode): ChoiceResult | null => {
    const rankings: Record<number, readonly CompareEntry[]> = {};
    const failed: number[] = [];
    for (const member of members) {
      const fromRun = liveFor(mode, member.slot);
      const entries = fromRun
        ? fromRun.result.rankings[member.slot]
        : readCachedResult<readonly CompareEntry[]>(
            keys[mode].get(member.slot) ?? ""
          );
      if (entries) rankings[member.slot] = entries;
      else if (fromRun?.result.failed.includes(member.slot))
        failed.push(member.slot);
    }
    return Object.keys(rankings).length || failed.length
      ? { rankings, failed }
      : null;
  };

  /** A member's job status in the run in progress, for its current inputs. */
  const statusFor = (
    mode: ChoiceMode,
    slot: number
  ): MemberJobStatus | undefined => {
    const fromRun = liveFor(mode, slot);
    return fromRun?.running ? fromRun.status.get(slot) : undefined;
  };

  /**
   * Keeps the applied member's ranking after one of its rows is applied to
   * the team: it does not depend on that member's current choice. Every
   * other member's ranking was computed with the old choice and is left to
   * the next run.
   */
  const carryOver = useCallback(
    (
      mode: ChoiceMode,
      slot: number,
      result: ChoiceResult,
      nextTeam: TeamPlan
    ) => {
      const { sources, members, budget } = latest.current;
      const member = members.find((entry) => entry.slot === slot);
      const entries = result.rankings[slot];
      if (member && entries)
        writeCachedResult(
          memberCacheKey(mode, nextTeam, sources, member, budget),
          entries
        );
    },
    []
  );

  return {
    resultFor,
    statusFor,
    /** The run in progress, even if the inputs changed since it started. */
    progress: live?.running ? live : null,
    running: Boolean(live?.running),
    run,
    stop,
    carryOver,
  };
}
