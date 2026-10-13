import { z } from "zod";
import { StableIdSchema } from "@/domain/game-account/schemas";
import { AnalysisModeSchema } from "@/domain/team/analysis";
import { TeamPresetSubscriptionSchema } from "@/domain/team/presetSubscription";
import { TeamPlanSchema } from "@/domain/team/schemas";

export const TEAM_STORE_VERSION = 3;

export const PersistedTeamStoreSchema = z
  .object({
    schemaVersion: z.literal(TEAM_STORE_VERSION),
    teams: z.array(TeamPlanSchema),
    presetSubscription: TeamPresetSubscriptionSchema.nullable().default(null),
    activeTeamId: StableIdSchema.nullable(),
    analysisByTeamId: z
      .record(
        z.string(),
        z.object({
          mode: AnalysisModeSchema.optional(),
          investment: z
            .object({
              limits: z.record(
                z.string(),
                z.object({
                  eidolon: z.number().int().min(0).max(6),
                  superimposition: z.number().int().min(1).max(5),
                })
              ),
              budget: z.enum(["realistic", "perfect"]),
              critMode: z.enum(["expected", "crit", "nonCrit"]),
            })
            .optional(),
        })
      )
      .default({}),
  })
  .strict();

export type PersistedTeamStore = z.infer<typeof PersistedTeamStoreSchema>;

export const DEFAULT_TEAM_STORE: PersistedTeamStore = {
  schemaVersion: TEAM_STORE_VERSION,
  teams: [],
  presetSubscription: null,
  activeTeamId: null,
  analysisByTeamId: {},
};
