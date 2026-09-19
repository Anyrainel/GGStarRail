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
import {
  type CharacterLightConeChoices,
  CharacterLightConeChoicesSchema,
} from "@/domain/build/lightConeChoices";
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
  setCharacterLightCones: (characterId: string, ids: string[]) => void;
  duplicateBuild: (buildId: string, name: string) => void;
  moveBuild: (buildId: string, direction: "up" | "down") => void;
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
    characterLightConeIds?: CharacterLightConeChoices;
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
      setCharacterLightCones: (characterId, ids) =>
        set((state) => ({
          characterLightConeIds: CharacterLightConeChoicesSchema.parse({
            ...state.characterLightConeIds,
            [characterId]: ids,
          }),
        })),
      duplicateBuild: (buildId, name) =>
        set((state) => {
          const index = state.builds.findIndex((build) => build.id === buildId);
          const build = state.builds[index];
          const profile = state.scoreProfiles.find(
            (entry) => entry.id === build?.scoreProfileId
          );
          if (!build || !profile) return state;
          const scoreProfileId = `score:${crypto.randomUUID()}`;
          const copy = {
            ...structuredClone(build),
            id: `build:${crypto.randomUUID()}`,
            name,
            scoreProfileId,
          };
          return {
            builds: [
              ...state.builds.slice(0, index + 1),
              copy,
              ...state.builds.slice(index + 1),
            ],
            scoreProfiles: [
              ...state.scoreProfiles,
              { ...structuredClone(profile), id: scoreProfileId },
            ],
          };
        }),
      moveBuild: (buildId, direction) =>
        set((state) => {
          const index = state.builds.findIndex((build) => build.id === buildId);
          const build = state.builds[index];
          if (!build) return state;
          const siblings = state.builds.flatMap((entry, i) =>
            entry.characterDefinitionId === build.characterDefinitionId
              ? [i]
              : []
          );
          const target =
            siblings[siblings.indexOf(index) + (direction === "up" ? -1 : 1)];
          if (target === undefined) return state;
          const builds = [...state.builds];
          [builds[index], builds[target]] = [builds[target]!, build];
          return { builds };
        }),
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
          const achievementIndex = seriesIds.indexOf(achievementId);
          if (achievementIndex < 0) return state;

          const currentCompletion = state.account
            ? state.account.achievementCompletion
            : state.localAchievementCompletion;
          const completedIds = new Set(currentCompletion?.completedIds ?? []);
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

          const achievementCompletion = AchievementCompletionSchema.parse({
            ...currentCompletion,
            completedIds: [...completedIds].sort((left, right) => left - right),
            locallyModifiedAt: now.toISOString(),
          });
          return state.account
            ? { account: { ...state.account, achievementCompletion } }
            : { localAchievementCompletion: achievementCompletion };
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
      replaceBuildWorkspace: ({
        builds,
        scoreProfiles,
        triageRules,
        characterLightConeIds = {},
      }) => set({ builds, scoreProfiles, triageRules, characterLightConeIds }),
      replaceWorkspace: (workspace) => set(workspace),
      clearWorkspace: () => set(structuredClone(DEFAULT_WORKSPACE)),
    }),
    {
      name: STORAGE_KEYS.workspace,
      version: WORKSPACE_STORE_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        characterLightConeIds: state.characterLightConeIds,
        account: state.account,
        localAchievementCompletion: state.localAchievementCompletion,
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
