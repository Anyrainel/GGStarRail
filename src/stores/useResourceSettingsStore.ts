import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";
import {
  type ResourceActionKind,
  type ResourceSettings,
  ResourceSettingsSchema,
} from "@/domain/resources/schemas";
import {
  migrateResourceSettings,
  RESOURCE_SETTINGS_STORE_VERSION,
} from "./migration/resourceSettings";
import {
  DEFAULT_PERSISTED_RESOURCE_SETTINGS,
  type PersistedResourceSettings,
  PersistedResourceSettingsSchema,
} from "./resourceSettingsSchemas";

interface ResourceSettingsActions {
  setActionEnabled: (kind: ResourceActionKind, enabled: boolean) => void;
  setMinimumScoreGap: (kind: ResourceActionKind, value: number) => void;
  replaceSettings: (settings: ResourceSettings) => void;
  resetSettings: () => void;
}

type ResourceSettingsState = PersistedResourceSettings &
  ResourceSettingsActions;

export const useResourceSettingsStore = create<ResourceSettingsState>()(
  persist(
    (set) => ({
      ...structuredClone(DEFAULT_PERSISTED_RESOURCE_SETTINGS),
      setActionEnabled: (kind, enabled) =>
        set((state) => ({
          settings: {
            ...state.settings,
            enabledActions: {
              ...state.settings.enabledActions,
              [kind]: enabled,
            },
          },
        })),
      setMinimumScoreGap: (kind, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            minimumScoreGap: {
              ...state.settings.minimumScoreGap,
              [kind]: Math.min(100, Math.max(0, value)),
            },
          },
        })),
      replaceSettings: (settings) =>
        set({ settings: ResourceSettingsSchema.parse(settings) }),
      resetSettings: () =>
        set(structuredClone(DEFAULT_PERSISTED_RESOURCE_SETTINGS)),
    }),
    {
      name: STORAGE_KEYS.resourceSettings,
      version: RESOURCE_SETTINGS_STORE_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        settings: state.settings,
      }),
      migrate: migrateResourceSettings,
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedResourceSettingsSchema.safeParse(persistedState);
        return parsed.success
          ? { ...currentState, ...parsed.data }
          : currentState;
      },
    }
  )
);
