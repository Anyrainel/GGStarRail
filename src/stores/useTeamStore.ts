import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";
import type { AnalysisMode } from "@/domain/team/analysis";
import { reconcileTeamPreset } from "@/domain/team/presetSubscription";
import {
  emptyTeam,
  type TeamMemberPlan,
  TeamMemberPlanSchema,
  type TeamPlan,
} from "@/domain/team/schemas";
import { migrateTeamStore } from "./migration/team";
import {
  DEFAULT_TEAM_STORE,
  type PersistedTeamStore,
  PersistedTeamStoreSchema,
  TEAM_STORE_VERSION,
} from "./teamSchemas";

interface TeamActions {
  replaceTeams: (
    input: Pick<
      PersistedTeamStore,
      "teams" | "activeTeamId" | "analysisByTeamId"
    > &
      Partial<Pick<PersistedTeamStore, "presetSubscription">>
  ) => void;
  subscribePreset: (presetId: string, teams: readonly TeamPlan[]) => void;
  hydratePreset: (presetId: string, teams: readonly TeamPlan[]) => void;
  stopPresetSubscription: () => void;
  setAnalysisMode: (teamId: string, mode: AnalysisMode) => void;
  setInvestmentSettings: (
    teamId: string,
    settings: NonNullable<
      PersistedTeamStore["analysisByTeamId"][string]["investment"]
    >
  ) => void;
  /** Adds an empty team at the start or end of the list (default end). */
  createTeam: (position?: "start" | "end") => string;
  duplicateTeam: (teamId: string) => string | null;
  removeTeam: (teamId: string) => void;
  /** Moves a team to a list index (clamped to the list). */
  moveTeam: (teamId: string, toIndex: number) => void;
  /** Deletes every team. */
  clearTeams: () => void;
  setActiveTeam: (teamId: string) => void;
  renameTeam: (teamId: string, name: string) => void;
  updateTeam: (
    teamId: string,
    patch: Partial<Pick<TeamPlan, "scenario" | "cycles" | "enemyLevel">>
  ) => void;
  setMember: (teamId: string, slot: number, characterId: string | null) => void;
  /** Removes a member and moves later members up, keeping filled slots first. */
  removeMember: (teamId: string, slot: number) => void;
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
      replaceTeams: (input) => {
        const parsed = PersistedTeamStoreSchema.parse({
          teams: input.teams,
          activeTeamId: input.activeTeamId,
          analysisByTeamId: input.analysisByTeamId,
          presetSubscription: input.presetSubscription ?? null,
          schemaVersion: TEAM_STORE_VERSION,
        });
        set(structuredClone(parsed));
      },
      subscribePreset: (presetId, teams) => {
        const parsed = PersistedTeamStoreSchema.parse({
          schemaVersion: TEAM_STORE_VERSION,
          teams,
          activeTeamId: teams[0]?.id ?? null,
          analysisByTeamId: {},
          presetSubscription: { presetId, baseline: teams, deletedTeamIds: [] },
        });
        set(structuredClone(parsed));
      },
      hydratePreset: (presetId, incoming) =>
        set((state) => {
          if (state.presetSubscription?.presetId !== presetId) return {};
          const result = reconcileTeamPreset(
            state.teams,
            state.presetSubscription,
            incoming
          );
          const ids = new Set(result.teams.map((team) => team.id));
          return {
            teams: result.teams,
            presetSubscription: result.subscription,
            activeTeamId:
              state.activeTeamId && ids.has(state.activeTeamId)
                ? state.activeTeamId
                : (result.teams[0]?.id ?? null),
            analysisByTeamId: Object.fromEntries(
              Object.entries(state.analysisByTeamId).filter(([id]) =>
                ids.has(id)
              )
            ),
          };
        }),
      stopPresetSubscription: () => set({ presetSubscription: null }),
      setAnalysisMode: (id, mode) =>
        set((state) => ({
          analysisByTeamId: {
            ...state.analysisByTeamId,
            [id]: { ...state.analysisByTeamId[id], mode },
          },
        })),
      setInvestmentSettings: (id, investment) =>
        set((state) => ({
          analysisByTeamId: {
            ...state.analysisByTeamId,
            [id]: { ...state.analysisByTeamId[id], investment },
          },
        })),
      createTeam: (position = "end") => {
        const team = emptyTeam(newId());
        set((state) => ({
          teams:
            position === "start"
              ? [team, ...state.teams]
              : [...state.teams, team],
          activeTeamId: team.id,
        }));
        return team.id;
      },
      duplicateTeam: (teamId) => {
        const source = get().teams.find((team) => team.id === teamId);
        if (!source) return null;
        const copy = { ...structuredClone(source), id: newId() };
        set((state) => ({
          teams: [...state.teams, copy],
          activeTeamId: copy.id,
          analysisByTeamId: state.analysisByTeamId[teamId]
            ? {
                ...state.analysisByTeamId,
                [copy.id]: structuredClone(state.analysisByTeamId[teamId]),
              }
            : state.analysisByTeamId,
        }));
        return copy.id;
      },
      removeTeam: (teamId) =>
        set((state) => {
          const teams = state.teams.filter((team) => team.id !== teamId);
          const analysisByTeamId = { ...state.analysisByTeamId };
          delete analysisByTeamId[teamId];
          return {
            teams,
            analysisByTeamId,
            presetSubscription:
              state.presetSubscription &&
              state.teams.some((team) => team.id === teamId)
                ? {
                    ...state.presetSubscription,
                    deletedTeamIds: [
                      ...new Set([
                        ...state.presetSubscription.deletedTeamIds,
                        teamId,
                      ]),
                    ],
                  }
                : state.presetSubscription,
            activeTeamId:
              state.activeTeamId === teamId
                ? (teams[0]?.id ?? null)
                : state.activeTeamId,
          };
        }),
      moveTeam: (teamId, toIndex) =>
        set((state) => {
          const from = state.teams.findIndex((team) => team.id === teamId);
          if (from < 0) return {};
          const target = Math.max(
            0,
            Math.min(state.teams.length - 1, Math.trunc(toIndex))
          );
          if (target === from) return {};
          const teams = [...state.teams];
          const [moved] = teams.splice(from, 1);
          if (!moved) return {};
          teams.splice(target, 0, moved);
          return { teams };
        }),
      clearTeams: () =>
        set({
          teams: [],
          activeTeamId: null,
          analysisByTeamId: {},
          presetSubscription: null,
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
      removeMember: (teamId, slot) =>
        set((state) =>
          mapTeam(state, teamId, (team) => {
            if (!team.members[slot]) return team;
            const members = team.members.filter((_, index) => index !== slot);
            members.push(null);
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
        presetSubscription: state.presetSubscription,
        activeTeamId: state.activeTeamId,
        analysisByTeamId: state.analysisByTeamId,
      }),
      migrate: migrateTeamStore,
      merge: (persistedState, currentState) => {
        const parsed = PersistedTeamStoreSchema.safeParse(persistedState);
        return parsed.success
          ? { ...currentState, ...parsed.data }
          : currentState;
      },
    }
  )
);
