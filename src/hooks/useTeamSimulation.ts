import { useEffect, useRef, useState } from "react";
import { runCombatJob } from "@/lib/combat/client";
import type { SimulateResponse, WorkspaceSources } from "@/lib/combat/jobs";
import type { TeamPlan } from "@/stores/teamSchemas";

export interface TeamSimulationState {
  /** Latest finished result; kept while a newer request runs. */
  readonly result: SimulateResponse | null;
  /** The team the result belongs to. */
  readonly teamId: string | null;
  readonly running: boolean;
  readonly failed: boolean;
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
  delay = 250
): TeamSimulationState {
  const [state, setState] = useState<TeamSimulationState>(IDLE);
  const latest = useRef(0);

  useEffect(() => {
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
      runCombatJob({ kind: "simulate", request: { team, sources } }).then(
        (result) => {
          if (latest.current !== request) return;
          setState({ result, teamId: team.id, running: false, failed: false });
        },
        () => {
          if (latest.current !== request) return;
          setState((current) => ({ ...current, running: false, failed: true }));
        }
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [team, sources, delay]);

  return state;
}
