import { z } from "zod";
import {
  BuildConfigurationSchema,
  ScoreProfileSchema,
  TriageRulesSchema,
} from "@/domain/build/schemas";
import { assertNoSensitiveFields } from "./security";

export const BuildWorkspaceBundleSchema = z
  .object({
    schema: z.literal("ggstarrail.build-workspace"),
    schemaVersion: z.literal(1),
    exportedAt: z.string().datetime(),
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

    const profileIds = new Set(
      value.scoreProfiles.map((profile) => profile.id)
    );
    for (const [index, build] of value.builds.entries()) {
      if (!profileIds.has(build.scoreProfileId)) {
        context.addIssue({
          code: "custom",
          message: `Build ${build.id} references a missing Score Profile`,
          path: ["builds", index, "scoreProfileId"],
        });
      }
    }
  });

export type BuildWorkspaceBundle = z.infer<typeof BuildWorkspaceBundleSchema>;

export function createBuildWorkspaceBundle(
  input: Omit<BuildWorkspaceBundle, "schema" | "schemaVersion" | "exportedAt">,
  now = new Date()
): BuildWorkspaceBundle {
  const bundle = BuildWorkspaceBundleSchema.parse({
    schema: "ggstarrail.build-workspace",
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    ...input,
  });
  assertNoSensitiveFields(bundle);
  return bundle;
}

export function serializeBuildWorkspaceBundle(
  input: Omit<BuildWorkspaceBundle, "schema" | "schemaVersion" | "exportedAt">
): string {
  return JSON.stringify(createBuildWorkspaceBundle(input), null, 2);
}

export function parseBuildWorkspaceBundle(input: string): BuildWorkspaceBundle {
  const parsed: unknown = JSON.parse(input);
  assertNoSensitiveFields(parsed);
  return BuildWorkspaceBundleSchema.parse(parsed);
}
