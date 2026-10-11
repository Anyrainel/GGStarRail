import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { TeamPlan } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

export const TEAM_PARAM = "team";

export interface TeamParam {
  /** The team named by `?team=`, when it exists. */
  readonly team: TeamPlan | null;
  /** Opens a team's detail (a new history entry, so Back returns to the grid). */
  readonly openTeam: (teamId: string) => void;
  /** Returns to the grid. */
  readonly closeTeam: () => void;
}

/**
 * The open team lives in the URL (`?team=<id>`). Unknown ids are dropped from
 * the URL; a valid one becomes the store's active team, which never opens the
 * detail on its own.
 */
export function useTeamParam(): TeamParam {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(TEAM_PARAM);
  const team = useTeamStore((state) =>
    requested
      ? (state.teams.find((entry) => entry.id === requested) ?? null)
      : null
  );
  const activeTeamId = useTeamStore((state) => state.activeTeamId);
  const setActiveTeam = useTeamStore((state) => state.setActiveTeam);
  const teamId = team?.id ?? null;

  useEffect(() => {
    if (!requested || teamId) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(TEAM_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [requested, teamId, setSearchParams]);

  useEffect(() => {
    if (teamId && teamId !== activeTeamId) setActiveTeam(teamId);
  }, [teamId, activeTeamId, setActiveTeam]);

  const openTeam = useCallback(
    (id: string) =>
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set(TEAM_PARAM, id);
        return next;
      }),
    [setSearchParams]
  );
  const closeTeam = useCallback(
    () =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete(TEAM_PARAM);
          return next;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  return { team, openTeam, closeTeam };
}
