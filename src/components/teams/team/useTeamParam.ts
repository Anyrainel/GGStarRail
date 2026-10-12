import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { TeamPlan } from "@/domain/team/schemas";
import { useTeamStore } from "@/stores/useTeamStore";

export const TEAM_PARAM = "team";

/** History state of a detail entry pushed from the grid. */
const OPENED_FROM_GRID = "teamDmgOpenedFromGrid";

export interface TeamParam {
  /** The team named by `?team=`, when it exists. */
  readonly team: TeamPlan | null;
  /**
   * Opens a team's detail: from the grid, a new history entry (so Back
   * returns to the grid); from a detail, in place of it.
   */
  readonly openTeam: (teamId: string) => void;
  /** Returns to the grid: back through history when the grid opened it. */
  readonly closeTeam: () => void;
}

/**
 * The open team lives in the URL (`?team=<id>`). Unknown ids are dropped from
 * the URL; a valid one becomes the store's active team, which never opens the
 * detail on its own.
 */
export function useTeamParam(): TeamParam {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requested = searchParams.get(TEAM_PARAM);
  const openedFromGrid =
    (location.state as Record<string, unknown> | null)?.[OPENED_FROM_GRID] ===
    true;
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
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set(TEAM_PARAM, id);
          const savedMode = useTeamStore.getState().analysisByTeamId[id]?.mode;
          next.set("mode", savedMode ?? "relics");
          return next;
        },
        requested
          ? { replace: true, state: location.state }
          : { state: { [OPENED_FROM_GRID]: true } }
      ),
    [requested, location.state, setSearchParams]
  );
  const closeTeam = useCallback(() => {
    // Popping the entry openTeam pushed keeps Back and Forward symmetric.
    if (openedFromGrid) {
      navigate(-1);
      return;
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(TEAM_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [openedFromGrid, navigate, setSearchParams]);

  return { team, openTeam, closeTeam };
}
