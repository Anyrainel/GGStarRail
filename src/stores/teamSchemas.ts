import { z } from "zod";
import { StableIdSchema } from "@/domain/game-account/schemas";
import { TeamPlanSchema } from "@/domain/team/schemas";

export const TEAM_STORE_VERSION = 1;

export const PersistedTeamStoreSchema = z
  .object({
    schemaVersion: z.literal(TEAM_STORE_VERSION),
    teams: z.array(TeamPlanSchema),
    activeTeamId: StableIdSchema.nullable(),
  })
  .strict();

export type PersistedTeamStore = z.infer<typeof PersistedTeamStoreSchema>;

export const DEFAULT_TEAM_STORE: PersistedTeamStore = {
  schemaVersion: TEAM_STORE_VERSION,
  teams: [],
  activeTeamId: null,
};
