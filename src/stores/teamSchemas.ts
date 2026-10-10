import { z } from "zod";
import { StableIdSchema } from "@/domain/account/schemas";
import { SCENARIO_PRESETS } from "@/domain/combat/team/input";

/**
 * A team member stores only what the user chose. Everything else (level,
 * Eidolon, Traces, equipped Light Cone and Relics) resolves from the account
 * at simulation time, so imports keep teams current.
 */
export const TeamMemberPlanSchema = z
  .object({
    characterId: StableIdSchema,
    level: z.number().int().min(1).max(80).optional(),
    eidolon: z.number().int().min(0).max(6).optional(),
    /** Undefined: equipped or preferred Light Cone. Null: none. */
    lightCone: z
      .object({
        id: StableIdSchema,
        superimposition: z.number().int().min(1).max(5),
      })
      .strict()
      .nullable()
      .optional(),
    /** Undefined: equipped Relics when owned, ideal Relics otherwise. */
    relics: z.enum(["equipped", "ideal"]).optional(),
    /** Ideal-Relic set plan; undefined uses the Character's builds. */
    setPlan: z
      .object({
        cavern: z.array(StableIdSchema).max(2),
        planar: StableIdSchema.nullable(),
      })
      .strict()
      .optional(),
    options: z
      .record(
        z.string(),
        z.record(z.string(), z.union([z.boolean(), z.number()]))
      )
      .default({}),
    skill: z.enum(["kit", "prefer", "avoid"]).default("kit"),
  })
  .strict();

const ScenarioPresetIdSchema = z.enum(
  Object.keys(SCENARIO_PRESETS) as [
    keyof typeof SCENARIO_PRESETS,
    ...(keyof typeof SCENARIO_PRESETS)[],
  ]
);

export const TeamPlanSchema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80).optional(),
    members: z.array(TeamMemberPlanSchema.nullable()).length(4),
    scenario: ScenarioPresetIdSchema,
    cycles: z.number().int().min(1).max(30),
    enemyLevel: z.number().int().min(1).max(120),
  })
  .strict();

export const TEAM_STORE_VERSION = 1;

export const PersistedTeamStoreSchema = z
  .object({
    schemaVersion: z.literal(TEAM_STORE_VERSION),
    teams: z.array(TeamPlanSchema),
    activeTeamId: StableIdSchema.nullable(),
  })
  .strict();

export type TeamMemberPlan = z.infer<typeof TeamMemberPlanSchema>;
export type TeamPlan = z.infer<typeof TeamPlanSchema>;
export type PersistedTeamStore = z.infer<typeof PersistedTeamStoreSchema>;

export const DEFAULT_TEAM_STORE: PersistedTeamStore = {
  schemaVersion: TEAM_STORE_VERSION,
  teams: [],
  activeTeamId: null,
};

export function emptyTeam(id: string): TeamPlan {
  return {
    id,
    members: [null, null, null, null],
    scenario: "bossWithAdds",
    cycles: SCENARIO_PRESETS.bossWithAdds.cycles,
    enemyLevel: SCENARIO_PRESETS.bossWithAdds.enemyLevel,
  };
}
