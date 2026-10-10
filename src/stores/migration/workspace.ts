import { z } from "zod";
import {
  type AccountSnapshot,
  AccountSnapshotV3Schema,
  migrateAccountSnapshotV3,
} from "@/domain/account/schemas";
import {
  DEFAULT_WORKSPACE,
  type PersistedWorkspace,
  PersistedWorkspaceSchema,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_USER_FIELDS,
} from "@/stores/schemas";

// Workspace v1 persisted account snapshots v3. Their Character trace records
// could hold interoperable-scanner keys (`skill:ult`, `trace:ability_1`, ...)
// instead of catalog trace point IDs; v2 stores account snapshots v4.
const PersistedWorkspaceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    account: AccountSnapshotV3Schema.nullable(),
    ...WORKSPACE_USER_FIELDS,
  })
  .strict();

function migrateWorkspaceV1(
  persistedState: unknown
): PersistedWorkspace | null {
  const previous = PersistedWorkspaceV1Schema.safeParse(persistedState);
  if (!previous.success) return null;
  let account: AccountSnapshot | null = null;
  try {
    account = previous.data.account
      ? migrateAccountSnapshotV3(previous.data.account)
      : null;
  } catch {
    return null;
  }
  const migrated = PersistedWorkspaceSchema.safeParse({
    ...previous.data,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    account,
  });
  return migrated.success ? migrated.data : null;
}

/**
 * Brings a persisted or backed-up workspace payload to the current version.
 * Unsupported or invalid payloads return null so callers choose between
 * starting empty (store hydration) and rejecting the input (backup import).
 */
export function migrateWorkspacePayload(
  payload: unknown
): PersistedWorkspace | null {
  const version =
    typeof payload === "object" &&
    payload !== null &&
    "schemaVersion" in payload
      ? payload.schemaVersion
      : undefined;
  if (version === 1) return migrateWorkspaceV1(payload);
  const current = PersistedWorkspaceSchema.safeParse(payload);
  return current.success ? current.data : null;
}

/** Zustand persist migration; incompatible stores start empty. */
export function migrateWorkspaceStore(
  persistedState: unknown,
  persistedVersion: number
): PersistedWorkspace {
  const migrated =
    persistedVersion === 1 || persistedVersion === WORKSPACE_SCHEMA_VERSION
      ? migrateWorkspacePayload(persistedState)
      : null;
  return migrated ?? structuredClone(DEFAULT_WORKSPACE);
}
