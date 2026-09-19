import { z } from "zod";
import { canonicalCharacterAssignments } from "@/domain/tier-list/characterAssignments";
import {
  DEFAULT_PRIORITY_STORE,
  type PersistedPriorityStore,
  PersistedPriorityStoreSchema,
  PriorityAssignmentsSchema,
} from "@/domain/tier-list/schemas";

export const PRIORITY_STORE_VERSION = 2;

// v1 allowed separate Caelus/Stelle placements. v2 uses one rank per kit.
const PersistedPriorityStoreV1Schema = PersistedPriorityStoreSchema.extend({
  schemaVersion: z.literal(1),
});

// Store v0 only persisted explicit tier assignments. It had no schema marker,
// Relic role ownership, or update timestamp.
const PersistedPriorityStoreV0Schema = z
  .object({
    assignments: PriorityAssignmentsSchema,
  })
  .strict();

export function migratePriorityStore(
  persistedState: unknown,
  persistedVersion: number,
  characters = false
): PersistedPriorityStore {
  if (persistedVersion === 0) {
    const previous = PersistedPriorityStoreV0Schema.safeParse(persistedState);
    if (!previous.success) return structuredClone(DEFAULT_PRIORITY_STORE);
    return {
      schemaVersion: 2,
      assignments: characters
        ? canonicalCharacterAssignments(previous.data.assignments)
        : previous.data.assignments,
      groupAssignments: {},
      updatedAt: 0,
    };
  }

  if (persistedVersion === 1) {
    const previous = PersistedPriorityStoreV1Schema.safeParse(persistedState);
    if (!previous.success) return structuredClone(DEFAULT_PRIORITY_STORE);
    return {
      ...previous.data,
      schemaVersion: 2,
      assignments: characters
        ? canonicalCharacterAssignments(previous.data.assignments)
        : previous.data.assignments,
    };
  }

  if (persistedVersion !== PRIORITY_STORE_VERSION) {
    return structuredClone(DEFAULT_PRIORITY_STORE);
  }

  const current = PersistedPriorityStoreSchema.safeParse(persistedState);
  return current.success
    ? {
        ...current.data,
        assignments: characters
          ? canonicalCharacterAssignments(current.data.assignments)
          : current.data.assignments,
      }
    : structuredClone(DEFAULT_PRIORITY_STORE);
}
