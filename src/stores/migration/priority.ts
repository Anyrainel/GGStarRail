import { z } from "zod";
import {
  DEFAULT_PRIORITY_STORE,
  type PersistedPriorityStore,
  PersistedPriorityStoreSchema,
  PriorityAssignmentsSchema,
} from "@/domain/tier-list/schemas";

export const PRIORITY_STORE_VERSION = 1;

// Store v0 only persisted explicit tier assignments. It had no schema marker,
// Relic role ownership, or update timestamp.
const PersistedPriorityStoreV0Schema = z
  .object({
    assignments: PriorityAssignmentsSchema,
  })
  .strict();

export function migratePriorityStore(
  persistedState: unknown,
  persistedVersion: number
): PersistedPriorityStore {
  if (persistedVersion === 0) {
    const previous = PersistedPriorityStoreV0Schema.safeParse(persistedState);
    if (!previous.success) return structuredClone(DEFAULT_PRIORITY_STORE);
    return {
      schemaVersion: 1,
      assignments: previous.data.assignments,
      groupAssignments: {},
      updatedAt: 0,
    };
  }

  if (persistedVersion !== PRIORITY_STORE_VERSION) {
    return structuredClone(DEFAULT_PRIORITY_STORE);
  }

  const current = PersistedPriorityStoreSchema.safeParse(persistedState);
  return current.success
    ? current.data
    : structuredClone(DEFAULT_PRIORITY_STORE);
}
