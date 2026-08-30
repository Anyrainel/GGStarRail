import {
  DEFAULT_WORKSPACE,
  type PersistedWorkspace,
  PersistedWorkspaceSchema,
} from "../schemas";

export const WORKSPACE_STORE_VERSION = 1;

export function migrateWorkspace(
  persistedState: unknown,
  persistedVersion: number
): PersistedWorkspace {
  if (persistedVersion !== WORKSPACE_STORE_VERSION) {
    return structuredClone(DEFAULT_WORKSPACE);
  }

  const parsed = PersistedWorkspaceSchema.safeParse(persistedState);
  return parsed.success ? parsed.data : structuredClone(DEFAULT_WORKSPACE);
}
