import { z } from "zod";
import { AccountSnapshotSchema } from "@/domain/account/schemas";
import {
  BuildConfigurationSchema,
  ComputedFilterSchema,
  ScoreProfileSchema,
  TriageRulesSchema,
} from "@/domain/build/schemas";

export const PersistedWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    account: AccountSnapshotSchema.nullable(),
    builds: z.array(BuildConfigurationSchema),
    scoreProfiles: z.array(ScoreProfileSchema),
    computedFilters: z.array(ComputedFilterSchema),
    triageRules: TriageRulesSchema,
  })
  .strict();

export type PersistedWorkspace = z.infer<typeof PersistedWorkspaceSchema>;

export const DEFAULT_WORKSPACE: PersistedWorkspace = {
  schemaVersion: 1,
  account: null,
  builds: [],
  scoreProfiles: [],
  computedFilters: [],
  triageRules: {
    keepScoreAtLeast: 30,
    reviewScoreAtLeast: 15,
    protectLocked: true,
    protectEquipped: true,
  },
};
