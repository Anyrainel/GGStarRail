import { z } from "zod";
import {
  AccountSnapshotSchema,
  AchievementCompletionSchema,
} from "@/domain/account/schemas";
import { CharacterLightConeChoicesSchema } from "@/domain/build/lightConeChoices";
import {
  BuildConfigurationSchema,
  ScoreProfileSchema,
  TriageRulesSchema,
} from "@/domain/build/schemas";

/** Workspace fields whose shape is shared by every supported store version. */
export const WORKSPACE_USER_FIELDS = {
  characterLightConeIds: CharacterLightConeChoicesSchema,
  localAchievementCompletion: AchievementCompletionSchema.default({
    completedIds: [],
  }),
  builds: z.array(BuildConfigurationSchema),
  scoreProfiles: z.array(ScoreProfileSchema),
  triageRules: TriageRulesSchema,
} as const;

export const WORKSPACE_SCHEMA_VERSION = 2;

export const PersistedWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    account: AccountSnapshotSchema.nullable(),
    ...WORKSPACE_USER_FIELDS,
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
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  characterLightConeIds: {},
  account: null,
  localAchievementCompletion: { completedIds: [] },
  builds: [],
  scoreProfiles: [],
  triageRules: {
    keepScoreAtLeast: 40,
    reviewScoreAtLeast: 20,
    protectLocked: true,
    protectEquipped: true,
  },
};
