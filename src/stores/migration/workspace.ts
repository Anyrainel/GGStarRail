import { z } from "zod";
import {
  DEFAULT_WORKSPACE,
  type PersistedWorkspace,
  PersistedWorkspaceSchema,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_USER_FIELDS,
} from "@/stores/schemas";
import { MigratingAccountSnapshotSchema } from "./account";

// Published workspace v1 held account v3; v2 held canonical account v4.
// The unpublished Quest branch used persist v2 with workspace v1/account v4.
const PreviousWorkspaceSchema = z
  .object({
    // Workspace v1–v3 held concrete builds with no preset subscription.
    schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    account: MigratingAccountSnapshotSchema.nullable(),
    ...WORKSPACE_USER_FIELDS,
  })
  .strict();

export function migrateWorkspacePayload(
  payload: unknown
): PersistedWorkspace | null {
  // Workspace v4 builds had no enabled, roles or minimumEidolon fields.
  // Absence remains enabled, unassigned and E0 at every schema boundary.
  if (
    typeof payload === "object" &&
    payload !== null &&
    "schemaVersion" in payload &&
    payload.schemaVersion === 4
  ) {
    payload = { ...payload, schemaVersion: WORKSPACE_SCHEMA_VERSION };
  }
  const current = PersistedWorkspaceSchema.safeParse(payload);
  if (current.success) return current.data;
  const previous = PreviousWorkspaceSchema.safeParse(payload);
  if (!previous.success) return null;
  const migrated = PersistedWorkspaceSchema.safeParse({
    ...previous.data,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    buildPresetSubscription: null,
  });
  return migrated.success ? migrated.data : null;
}

export function migrateWorkspaceStore(
  persistedState: unknown,
  persistedVersion: number
): PersistedWorkspace {
  const migrated = [1, 2, 3, 4, WORKSPACE_SCHEMA_VERSION].includes(
    persistedVersion
  )
    ? migrateWorkspacePayload(persistedState)
    : null;
  return migrated ?? structuredClone(DEFAULT_WORKSPACE);
}
