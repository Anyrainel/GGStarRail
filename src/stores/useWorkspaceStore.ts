import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/identity";
import type { AccountSnapshot } from "@/domain/account/schemas";
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
  replaceWorkspace: (workspace: PersistedWorkspace) => void;
  clearWorkspace: () => void;
}

type WorkspaceState = PersistedWorkspace & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      ...structuredClone(DEFAULT_WORKSPACE),
      replaceAccount: (account) => set({ account }),
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
        computedFilters: state.computedFilters,
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
