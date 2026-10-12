import { useEffect, useRef, useState } from "react";
import type { CritMode } from "@/domain/combat/model/formulas";
import type { TeamPlan } from "@/domain/team/schemas";
import { isCombatJobCancelled, runCombatJob } from "@/services/combat/client";
import type {
  SimulateResponse,
  WorkspaceSources,
} from "@/services/combat/jobs";

export interface TeamSimulationState {
  /** Latest finished result; kept while a newer request runs. */
  readonly result: SimulateResponse | null;
  /** The team the result belongs to. */
  readonly teamId: string | null;
  readonly running: boolean;
  readonly failed: boolean;
}

export interface TeamSimulationOptions {
  readonly enabled?: boolean;
  /** Expected (default), always-crit, or never-crit damage. */
  readonly critMode?: CritMode;
  /** Debounce before a changed team is simulated, in ms. */
  readonly delay?: number;
}

const IDLE: TeamSimulationState = {
  result: null,
  teamId: null,
  running: false,
  failed: false,
};

/** Re-simulates a team shortly after its plan or the workspace changes. */
export function useTeamSimulation(
  team: TeamPlan | null,
  sources: WorkspaceSources,
  options: TeamSimulationOptions = {}
): TeamSimulationState {
  const { critMode, delay = 250, enabled = true } = options;
  const [state, setState] = useState<TeamSimulationState>(IDLE);
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!team || team.members.every((member) => member === null)) {
      latest.current += 1;
      setState(IDLE);
      return;
    }
    const request = latest.current + 1;
    latest.current = request;
    setState((current) => ({
      ...current,
      result: current.teamId === team.id ? current.result : null,
      teamId: team.id,
      running: true,
      failed: false,
    }));
    const timer = window.setTimeout(() => {
      runCombatJob({
        kind: "simulate",
        request: { team, sources, critMode },
      }).then(
        (result) => {
          if (latest.current !== request) return;
          setState({ result, teamId: team.id, running: false, failed: false });
        },
        (error: unknown) => {
          if (latest.current !== request) return;
          if (isCombatJobCancelled(error)) {
            setState((current) => ({ ...current, running: false }));
            return;
          }
          setState((current) => ({ ...current, running: false, failed: true }));
        }
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [team, sources, critMode, delay, enabled]);

  return state;
}
