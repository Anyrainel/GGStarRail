import { DEFAULT_WORKSPACE, PersistedWorkspaceSchema } from "../schemas";

export function migrateWorkspaceV1(state: unknown) {
  // Persist middleware version 1 used account v3 and no Quest snapshots.
  const parsed = PersistedWorkspaceSchema.safeParse(state);
  return parsed.success ? parsed.data : structuredClone(DEFAULT_WORKSPACE);
}
