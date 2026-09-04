import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";
import {
  type AccountImportMode,
  applyAccountImport,
} from "@/domain/account/merge";
import {
  type AccountSnapshot,
  AchievementCompletionSchema,
} from "@/domain/account/schemas";
import type {
  BuildConfiguration,
  ScoreProfile,
  TriageRules,
} from "@/domain/build/schemas";
import {
  migrateWorkspace,
  WORKSPACE_STORE_VERSION,
} from "./migration/workspace";
import {
  DEFAULT_WORKSPACE,
  type PersistedWorkspace,
  PersistedWorkspaceSchema,
} from "./schemas";

interface WorkspaceActions {
  replaceAccount: (account: AccountSnapshot) => void;
  applyAccountImport: (
    account: AccountSnapshot,
    mode: AccountImportMode
  ) => void;
  setSeriesAchievementStatus: (
    seriesIds: readonly number[],
    achievementId: number,
    completed: boolean,
    now?: Date
  ) => void;
  upsertBuild: (build: BuildConfiguration) => void;
  removeBuild: (buildId: string) => void;
  upsertScoreProfile: (profile: ScoreProfile) => void;
  removeScoreProfile: (profileId: string) => void;
  setTriageRules: (rules: TriageRules) => void;
  replaceBuildWorkspace: (value: {
    builds: BuildConfiguration[];
    scoreProfiles: ScoreProfile[];
    triageRules: TriageRules;
  }) => void;
  replaceWorkspace: (workspace: PersistedWorkspace) => void;
  clearWorkspace: () => void;
}

type WorkspaceState = PersistedWorkspace & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      ...structuredClone(DEFAULT_WORKSPACE),
      replaceAccount: (account) => set({ account }),
      applyAccountImport: (account, mode) =>
        set((state) => ({
          account: applyAccountImport(state.account, account, mode),
        })),
      setSeriesAchievementStatus: (
        seriesIds,
        achievementId,
        completed,
        now = new Date()
      ) =>
        set((state) => {
          if (!state.account) return state;
          const achievementIndex = seriesIds.indexOf(achievementId);
          if (achievementIndex < 0) return state;

          const completedIds = new Set(
            state.account.achievementCompletion?.completedIds ?? []
          );
          const affectedIds = completed
            ? seriesIds.slice(0, achievementIndex + 1)
            : seriesIds.slice(achievementIndex);
          for (const id of affectedIds) {
            if (!Number.isInteger(id) || id <= 0 || id > 0xffff_ffff) {
              continue;
            }
            if (completed) completedIds.add(id);
            else completedIds.delete(id);
          }

          return {
            account: {
              ...state.account,
              achievementCompletion: AchievementCompletionSchema.parse({
                ...state.account.achievementCompletion,
                completedIds: [...completedIds].sort(
                  (left, right) => left - right
                ),
                locallyModifiedAt: now.toISOString(),
              }),
            },
          };
        }),
      upsertBuild: (build) =>
        set((state) => ({
          builds: state.builds.some((candidate) => candidate.id === build.id)
            ? state.builds.map((candidate) =>
                candidate.id === build.id ? build : candidate
              )
            : [...state.builds, build],
        })),
      removeBuild: (buildId) =>
        set((state) => ({
          builds: state.builds.filter((build) => build.id !== buildId),
        })),
      upsertScoreProfile: (profile) =>
        set((state) => ({
          scoreProfiles: state.scoreProfiles.some(
            (candidate) => candidate.id === profile.id
          )
            ? state.scoreProfiles.map((candidate) =>
                candidate.id === profile.id ? profile : candidate
              )
            : [...state.scoreProfiles, profile],
        })),
      removeScoreProfile: (profileId) =>
        set((state) => ({
          scoreProfiles: state.scoreProfiles.filter(
            (profile) => profile.id !== profileId
          ),
          builds: state.builds.filter(
            (build) => build.scoreProfileId !== profileId
          ),
        })),
      setTriageRules: (triageRules) => set({ triageRules }),
      replaceBuildWorkspace: ({ builds, scoreProfiles, triageRules }) =>
        set({ builds, scoreProfiles, triageRules }),
      replaceWorkspace: (workspace) => set(workspace),
      clearWorkspace: () => set(structuredClone(DEFAULT_WORKSPACE)),
    }),
    {
      name: STORAGE_KEYS.workspace,
      version: WORKSPACE_STORE_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        account: state.account,
        builds: state.builds,
        scoreProfiles: state.scoreProfiles,
        triageRules: state.triageRules,
      }),
      migrate: migrateWorkspace,
      merge: (persistedState, currentState) => {
        const parsed = PersistedWorkspaceSchema.safeParse(persistedState);
        return parsed.success
          ? { ...currentState, ...parsed.data }
          : currentState;
      },
    }
  )
);
