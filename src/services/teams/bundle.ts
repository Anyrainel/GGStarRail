import { z } from "zod";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import { TeamPresetSubscriptionSchema } from "@/domain/team/presetSubscription";
import { TeamPlanSchema } from "@/domain/team/schemas";
import { assertNoSensitiveFields } from "@/lib/security/credentials";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { PersistedTeamStoreSchema } from "@/stores/teamSchemas";

export const TeamWorkspaceBundleSchema = z
  .object({
    schema: z.literal("ggstarrail.team-workspace"),
    schemaVersion: z.literal(2),
    exportedAt: z.string().datetime(),
    teams: z.array(TeamPlanSchema),
    presetSubscription: TeamPresetSubscriptionSchema.nullable().default(null),
    activeTeamId: PersistedTeamStoreSchema.shape.activeTeamId,
    analysisByTeamId: PersistedTeamStoreSchema.shape.analysisByTeamId,
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.teams.forEach((team, index) => {
      if (ids.has(team.id))
        context.addIssue({
          code: "custom",
          message: "Duplicate team ID",
          path: ["teams", index, "id"],
        });
      ids.add(team.id);
      const characters = team.members.flatMap((member) =>
        member ? [canonicalCharacterId(member.characterId)] : []
      );
      if (new Set(characters).size !== characters.length)
        context.addIssue({
          code: "custom",
          message: "Duplicate team member",
          path: ["teams", index, "members"],
        });
    });
    if (value.activeTeamId !== null && !ids.has(value.activeTeamId))
      context.addIssue({
        code: "custom",
        message: "Unknown active team",
        path: ["activeTeamId"],
      });
    for (const id of Object.keys(value.analysisByTeamId))
      if (!ids.has(id))
        context.addIssue({
          code: "custom",
          message: "Unknown analysis team",
          path: ["analysisByTeamId", id],
        });
  });

export type TeamWorkspaceBundle = z.infer<typeof TeamWorkspaceBundleSchema>;
type TeamWorkspaceInput = Pick<
  TeamWorkspaceBundle,
  "teams" | "activeTeamId" | "analysisByTeamId"
> &
  Partial<Pick<TeamWorkspaceBundle, "presetSubscription">>;

export function createTeamWorkspaceBundle(
  input: TeamWorkspaceInput,
  now = new Date()
): TeamWorkspaceBundle {
  assertNoSensitiveFields(input);
  return TeamWorkspaceBundleSchema.parse({
    ...input,
    schema: "ggstarrail.team-workspace",
    schemaVersion: 2,
    exportedAt: now.toISOString(),
  });
}

export function parseTeamWorkspaceBundle(text: string): TeamWorkspaceBundle {
  const value: unknown = JSON.parse(text);
  assertNoSensitiveFields(value);
  // v1 was a standalone snapshot with no subscription identity or baseline.
  // Import it as authored teams; never guess subscription from preset-like IDs.
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1
  ) {
    return TeamWorkspaceBundleSchema.parse({
      ...value,
      schemaVersion: 2,
      presetSubscription: null,
    });
  }
  return TeamWorkspaceBundleSchema.parse(value);
}

/** Catalog validation is a recoverable review result; no state changes here. */
export function teamBundleReferenceIssue(
  bundle: TeamWorkspaceBundle,
  references: BuildReferences
): string | null {
  for (const team of [
    ...bundle.teams,
    ...(bundle.presetSubscription?.baseline ?? []),
  ])
    for (const member of team.members) {
      if (!member) continue;
      const character = references.characters.byId.get(member.characterId);
      if (!character) return member.characterId;
      if (member.lightCone) {
        const cone = references.lightCones.byId.get(member.lightCone.id);
        if (!cone || cone.path_id !== character.path_id)
          return member.lightCone.id;
      }
      if (member.setPlan) {
        for (const id of member.setPlan.cavern)
          if (references.relicSets.byId.get(id)?.kind !== "cavern_relic")
            return id;
        if (
          member.setPlan.planar &&
          references.relicSets.byId.get(member.setPlan.planar)?.kind !==
            "planar_ornament"
        )
          return member.setPlan.planar;
      }
      for (const source of Object.values(member.options))
        for (const value of Object.values(source)) {
          if (
            typeof value === "string" &&
            !references.characters.byId.has(value)
          )
            return value;
        }
    }
  for (const settings of Object.values(bundle.analysisByTeamId))
    for (const id of Object.keys(settings.investment?.limits ?? {})) {
      const characterId = /^[0-3]:/.test(id) ? id.slice(2) : id;
      if (!references.characters.byId.has(characterId)) return id;
    }
  return null;
}
