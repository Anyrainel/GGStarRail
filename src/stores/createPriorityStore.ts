import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_PRIORITY_STORE,
  type PersistedPriorityStore,
  PersistedPriorityStoreSchema,
} from "@/domain/tier-list/schemas";
import type {
  PriorityAssignments,
  RelicGroupAssignments,
} from "@/domain/tier-list/types";
import {
  migratePriorityStore,
  PRIORITY_STORE_VERSION,
} from "./migration/priority";

export interface PriorityStoreActions {
  setPriorityState: (value: {
    assignments: PriorityAssignments;
    groupAssignments?: RelicGroupAssignments;
  }) => void;
  resetPriorities: () => void;
}

export type PriorityStoreState = PersistedPriorityStore & PriorityStoreActions;

export function createPriorityStore(storageKey: string) {
  return create<PriorityStoreState>()(
    persist(
      (set) => ({
        ...structuredClone(DEFAULT_PRIORITY_STORE),
        setPriorityState: ({ assignments, groupAssignments }) =>
          set((state) => ({
            assignments,
            groupAssignments: groupAssignments ?? state.groupAssignments,
            updatedAt: Date.now(),
          })),
        resetPriorities: () =>
          set({
            ...structuredClone(DEFAULT_PRIORITY_STORE),
            updatedAt: Date.now(),
          }),
      }),
      {
        name: storageKey,
        version: PRIORITY_STORE_VERSION,
        migrate: migratePriorityStore,
        partialize: (state) => ({
          schemaVersion: state.schemaVersion,
          assignments: state.assignments,
          groupAssignments: state.groupAssignments,
          updatedAt: state.updatedAt,
        }),
        merge: (persistedState, currentState) => {
          const parsed = PersistedPriorityStoreSchema.safeParse(persistedState);
          return parsed.success
            ? { ...currentState, ...parsed.data }
            : currentState;
        },
      }
    )
  );
}
