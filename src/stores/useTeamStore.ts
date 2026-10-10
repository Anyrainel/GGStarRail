import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";
import {
  DEFAULT_TEAM_STORE,
  emptyTeam,
  type PersistedTeamStore,
  PersistedTeamStoreSchema,
  TEAM_STORE_VERSION,
  type TeamMemberPlan,
  TeamMemberPlanSchema,
  type TeamPlan,
} from "./teamSchemas";

interface TeamActions {
  createTeam: () => string;
  duplicateTeam: (teamId: string) => void;
  removeTeam: (teamId: string) => void;
  setActiveTeam: (teamId: string) => void;
  renameTeam: (teamId: string, name: string) => void;
  updateTeam: (
    teamId: string,
    patch: Partial<Pick<TeamPlan, "scenario" | "cycles" | "enemyLevel">>
  ) => void;
  setMember: (teamId: string, slot: number, characterId: string | null) => void;
  updateMember: (
    teamId: string,
    slot: number,
    patch: Partial<TeamMemberPlan>
  ) => void;
}

type TeamState = PersistedTeamStore & TeamActions;

function newId(): string {
  return `team:${crypto.randomUUID()}`;
}

function mapTeam(
  state: PersistedTeamStore,
  teamId: string,
  update: (team: TeamPlan) => TeamPlan
): Pick<PersistedTeamStore, "teams"> {
  return {
    teams: state.teams.map((team) =>
      team.id === teamId ? update(team) : team
    ),
  };
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      ...structuredClone(DEFAULT_TEAM_STORE),
      createTeam: () => {
        const team = emptyTeam(newId());
        set((state) => ({
          teams: [...state.teams, team],
          activeTeamId: team.id,
        }));
        return team.id;
      },
      duplicateTeam: (teamId) => {
        const source = get().teams.find((team) => team.id === teamId);
        if (!source) return;
        const copy = { ...structuredClone(source), id: newId() };
        set((state) => ({
          teams: [...state.teams, copy],
          activeTeamId: copy.id,
        }));
      },
      removeTeam: (teamId) =>
        set((state) => {
          const teams = state.teams.filter((team) => team.id !== teamId);
          return {
            teams,
            activeTeamId:
              state.activeTeamId === teamId
                ? (teams[0]?.id ?? null)
                : state.activeTeamId,
          };
        }),
      setActiveTeam: (teamId) => set({ activeTeamId: teamId }),
      renameTeam: (teamId, name) =>
        set((state) =>
          mapTeam(state, teamId, (team) => ({
            ...team,
            name: name.trim() ? name.trim().slice(0, 80) : undefined,
          }))
        ),
      updateTeam: (teamId, patch) =>
        set((state) =>
          mapTeam(state, teamId, (team) => ({ ...team, ...patch }))
        ),
      setMember: (teamId, slot, characterId) =>
        set((state) =>
          mapTeam(state, teamId, (team) => {
            const members = [...team.members];
            members[slot] = characterId
              ? TeamMemberPlanSchema.parse({ characterId })
              : null;
            return { ...team, members };
          })
        ),
      updateMember: (teamId, slot, patch) =>
        set((state) =>
          mapTeam(state, teamId, (team) => {
            const current = team.members[slot];
            if (!current) return team;
            const members = [...team.members];
            members[slot] = TeamMemberPlanSchema.parse({
              ...current,
              ...patch,
            });
            return { ...team, members };
          })
        ),
    }),
    {
      name: STORAGE_KEYS.teams,
      version: TEAM_STORE_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        teams: state.teams,
        activeTeamId: state.activeTeamId,
      }),
      // The store is new in this version; other versions start empty.
      migrate: () => structuredClone(DEFAULT_TEAM_STORE),
      merge: (persistedState, currentState) => {
        const parsed = PersistedTeamStoreSchema.safeParse(persistedState);
        return parsed.success
          ? { ...currentState, ...parsed.data }
          : currentState;
      },
    }
  )
);
