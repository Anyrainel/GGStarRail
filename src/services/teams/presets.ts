import { z } from "zod";
import { TeamPlanSchema } from "@/domain/team/schemas";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { createTeamWorkspaceBundle, teamBundleReferenceIssue } from "./bundle";

export const TeamPresetSchema = z
  .object({
    schema: z.literal("ggstarrail.team-preset"),
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    name: z
      .object({ en: z.string().min(1), "zh-CN": z.string().min(1) })
      .strict(),
    teams: z.array(TeamPlanSchema),
  })
  .strict();

export const TEAM_PRESET_OPTIONS = [
  { id: "flagship-teams", labelKey: "teamDmg.presetFlagship" },
] as const;
const registry: Record<string, () => Promise<{ default: unknown }>> = {
  "flagship-teams": () => import("@/config/presets/teams/flagship.json"),
};

export async function loadTeamPreset(id: string) {
  const load = registry[id];
  if (!load) throw new Error(`Unknown team preset: ${id}`);
  const parsed = TeamPresetSchema.parse((await load()).default);
  if (parsed.id !== id) throw new Error(`Team preset identity mismatch: ${id}`);
  const bundle = createTeamWorkspaceBundle({
    teams: parsed.teams,
    activeTeamId: null,
    analysisByTeamId: {},
  });
  return { ...parsed, teams: bundle.teams };
}

export function assertTeamPresetReferences(
  teams: Awaited<ReturnType<typeof loadTeamPreset>>["teams"],
  references: BuildReferences
): void {
  const issue = teamBundleReferenceIssue(
    createTeamWorkspaceBundle({
      teams,
      activeTeamId: null,
      analysisByTeamId: {},
    }),
    references
  );
  if (issue) throw new Error(`Invalid bundled team reference: ${issue}`);
}
