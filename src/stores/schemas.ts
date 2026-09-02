import { z } from "zod";
import { AccountSnapshotSchema } from "@/domain/account/schemas";
import {
  BuildConfigurationSchema,
  ScoreProfileSchema,
  TriageRulesSchema,
} from "@/domain/build/schemas";

export const PersistedWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(2),
    account: AccountSnapshotSchema.nullable(),
    builds: z.array(BuildConfigurationSchema),
    scoreProfiles: z.array(ScoreProfileSchema),
    triageRules: TriageRulesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    const addDuplicateIssues = (
      values: readonly { id: string }[],
      path: "builds" | "scoreProfiles"
    ) => {
      values.forEach(({ id }, index) => {
        if (seen.has(id)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate ${path} id`,
            path: [path, index, "id"],
          });
        }
        seen.add(id);
      });
    };

    addDuplicateIssues(value.builds, "builds");
    addDuplicateIssues(value.scoreProfiles, "scoreProfiles");

    const profileIds = new Set(value.scoreProfiles.map(({ id }) => id));
    value.builds.forEach((build, index) => {
      if (!profileIds.has(build.scoreProfileId)) {
        context.addIssue({
          code: "custom",
          message: "Build references a missing Score Profile",
          path: ["builds", index, "scoreProfileId"],
        });
      }
    });
  });

export type PersistedWorkspace = z.infer<typeof PersistedWorkspaceSchema>;

export const DEFAULT_WORKSPACE: PersistedWorkspace = {
  schemaVersion: 2,
  account: null,
  builds: [],
  scoreProfiles: [],
  triageRules: {
    keepScoreAtLeast: 40,
    reviewScoreAtLeast: 20,
    protectLocked: true,
    protectEquipped: true,
  },
};
