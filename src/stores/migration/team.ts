import {
  DEFAULT_TEAM_STORE,
  PersistedTeamStoreSchema,
  TEAM_STORE_VERSION,
} from "@/stores/teamSchemas";

/** v1 persisted only {schemaVersion:1, teams, activeTeamId}, and every chosen
 * cone contained an explicit S. Keep those authored ranks unchanged. v2 adds
 * optional per-team analysis settings; newly omitted S resolves owned copies.
 * v2 persisted {schemaVersion:2,teams,activeTeamId,analysisByTeamId} without
 * preset identity. v3 adds a nullable file subscription and previous baseline;
 * old authored teams remain independent, never inferred as subscriptions. */
export function migrateTeamStore(value: unknown, version?: number): unknown {
  if (
    version !== undefined &&
    version !== 1 &&
    version !== 2 &&
    version !== TEAM_STORE_VERSION
  ) {
    throw new Error(`Unsupported team store version: ${version}`);
  }
  if (!value || typeof value !== "object")
    return structuredClone(DEFAULT_TEAM_STORE);
  if (!("schemaVersion" in value)) return structuredClone(DEFAULT_TEAM_STORE);
  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== TEAM_STORE_VERSION
  )
    throw new Error(
      `Unsupported team schema version: ${String(value.schemaVersion)}`
    );
  const parsed = PersistedTeamStoreSchema.safeParse({
    ...value,
    schemaVersion: TEAM_STORE_VERSION,
  });
  return parsed.success ? parsed.data : structuredClone(DEFAULT_TEAM_STORE);
}
