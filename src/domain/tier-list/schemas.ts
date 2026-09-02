import { z } from "zod";
import { PRIORITY_TIERS, RELIC_PRIORITY_GROUPS } from "./constants";

export const PriorityPlacementSchema = z
  .object({
    tier: z.enum(PRIORITY_TIERS),
    position: z.number().int().nonnegative(),
  })
  .strict();

export const PriorityAssignmentsSchema = z.record(
  z.string().min(1),
  PriorityPlacementSchema
);

export const RelicGroupAssignmentsSchema = z.record(
  z.string().min(1),
  z.enum(RELIC_PRIORITY_GROUPS)
);

export const PersistedPriorityStoreSchema = z
  .object({
    schemaVersion: z.literal(1),
    assignments: PriorityAssignmentsSchema,
    groupAssignments: RelicGroupAssignmentsSchema,
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

export type PersistedPriorityStore = z.infer<
  typeof PersistedPriorityStoreSchema
>;

export const DEFAULT_PRIORITY_STORE: PersistedPriorityStore = {
  schemaVersion: 1,
  assignments: {},
  groupAssignments: {},
  updatedAt: 0,
};
