import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberJobStatus } from "@/components/damage/team/MemberProgress";
import type { CritMode } from "@/domain/combat/model/formulas";
import type { SubstatBudget } from "@/domain/combat/optimize/idealRelics";
import {
  cancelCombatJobs,
  isCombatJobCancelled,
  runCombatJob,
} from "@/lib/combat/client";
import type { WorkspaceSources } from "@/lib/combat/jobs";
import {
  readCachedResult,
  resultCacheKey,
  writeCachedResult,
} from "@/lib/combat/resultCache";
import type { TeamPlan } from "@/stores/teamSchemas";
import type { InvestmentLimits, MemberPath } from "./investmentModel";

/** A member as the run starts it (resolved on the main thread). */
export interface InvestmentMember extends Omit<MemberPath, "start" | "steps"> {
  readonly limits: InvestmentLimits;
}

export interface InvestmentOptions {
  readonly budget: SubstatBudget;
  readonly critMode: CritMode;
}

export interface InvestmentResult {
  readonly paths: readonly MemberPath[];
  /** Slots whose job failed. */
  readonly failed: readonly number[];
}

export interface InvestmentRunState {
  /** Finished (or partial, while running) result for the current inputs. */
  readonly result: InvestmentResult | null;
  readonly running: boolean;
  /** Job status by slot for the current or last run. */
  readonly status: ReadonlyMap<number, MemberJobStatus>;
  readonly run: () => void;
  readonly stop: () => void;
}

interface RunSnapshot {
  readonly key: string;
  readonly result: InvestmentResult;
}

function cacheKey(
  team: TeamPlan,
  sources: WorkspaceSources,
  members: readonly InvestmentMember[],
  options: InvestmentOptions
): string {
  return resultCacheKey("investment", "path", team, sources, {
    ...options,
    limits: members.map((member) => [member.slot, member.limits]),
  });
}

/**
 * Runs one investment job per member on the analysis lane, one member at a
 * time, and keeps finished results for the session.
 */
export function useInvestmentRun(
  team: TeamPlan,
  sources: WorkspaceSources,
  members: readonly InvestmentMember[],
  options: InvestmentOptions
): InvestmentRunState {
  const key = cacheKey(team, sources, members, options);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<ReadonlyMap<number, MemberJobStatus>>(
    () => new Map()
  );
  const runId = useRef(0);
  const runningRef = useRef(false);
  const latest = useRef({ team, sources, members, options, key });
  latest.current = { team, sources, members, options, key };

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    runId.current += 1;
    runningRef.current = false;
    cancelCombatJobs("analysis");
    setRunning(false);
    setStatus(
      (current) =>
        new Map(
          [...current].map(([slot, value]) => [
            slot,
            value === "done" || value === "failed" ? value : "pending",
          ])
        )
    );
  }, []);

  const run = useCallback(() => {
    const { team, sources, members, options, key } = latest.current;
    if (!members.length) return;
    const id = runId.current + 1;
    runId.current = id;
    runningRef.current = true;
    setRunning(true);
    setStatus(new Map(members.map((member) => [member.slot, "pending"])));
    setSnapshot({ key, result: { paths: [], failed: [] } });

    void (async () => {
      const paths: MemberPath[] = [];
      const failed: number[] = [];
      for (const member of members) {
        if (runId.current !== id) return;
        setStatus((current) => new Map(current).set(member.slot, "running"));
        try {
          const response = await runCombatJob({
            kind: "investment",
            request: {
              team,
              sources,
              slot: member.slot,
              critMode: options.critMode,
              budget: options.budget,
              limits: {
                maxEidolon: member.limits.eidolon,
                maxSuperimposition: member.limits.superimposition,
              },
            },
          });
          if (runId.current !== id) return;
          const { limits: _limits, ...rest } = member;
          paths.push({ ...rest, start: response.start, steps: response.steps });
          setStatus((current) => new Map(current).set(member.slot, "done"));
        } catch (error) {
          if (runId.current !== id) return;
          if (isCombatJobCancelled(error)) {
            // Stopped from elsewhere: keep what finished.
            runningRef.current = false;
            setRunning(false);
            return;
          }
          failed.push(member.slot);
          setStatus((current) => new Map(current).set(member.slot, "failed"));
        }
        setSnapshot({
          key,
          result: { paths: [...paths], failed: [...failed] },
        });
      }
      if (runId.current !== id) return;
      const result = { paths, failed };
      if (paths.length) writeCachedResult(key, result);
      runningRef.current = false;
      setRunning(false);
    })();
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

  const result =
    snapshot?.key === key
      ? snapshot.result
      : (readCachedResult<InvestmentResult>(key) ?? null);
  return { result, running, status, run, stop };
}
