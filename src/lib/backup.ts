import { z } from "zod";
import { BACKUP_IDENTITY } from "@/config/identity";
import { migrateWorkspacePayload } from "@/stores/migration/workspace";
import {
  type PersistedWorkspace,
  PersistedWorkspaceSchema,
} from "@/stores/schemas";
import { assertNoSensitiveFields } from "./security";

const BackupEnvelopeFields = {
  product: z.literal(BACKUP_IDENTITY.product),
  kind: z.literal(BACKUP_IDENTITY.kind),
  schemaVersion: z.literal(BACKUP_IDENTITY.schemaVersion),
  createdAt: z.string().datetime(),
} as const;

export const BackupEnvelopeSchema = z
  .object({ ...BackupEnvelopeFields, payload: PersistedWorkspaceSchema })
  .strict();

/** The payload carries its own workspace version and migrates on import. */
const IncomingBackupEnvelopeSchema = z
  .object({ ...BackupEnvelopeFields, payload: z.unknown() })
  .strict();

export type BackupEnvelope = z.infer<typeof BackupEnvelopeSchema>;

export function createBackupEnvelope(
  workspace: PersistedWorkspace,
  now = new Date()
): BackupEnvelope {
  const payload = PersistedWorkspaceSchema.parse(workspace);
  assertNoSensitiveFields(payload);
  return {
    ...BACKUP_IDENTITY,
    createdAt: now.toISOString(),
    payload,
  };
}

export function serializeBackup(workspace: PersistedWorkspace): string {
  return JSON.stringify(createBackupEnvelope(workspace), null, 2);
}

export function parseBackup(input: string): BackupEnvelope {
  const parsed: unknown = JSON.parse(input);
  assertNoSensitiveFields(parsed);
  const envelope = IncomingBackupEnvelopeSchema.parse(parsed);
  const payload = migrateWorkspacePayload(envelope.payload);
  if (!payload) throw new Error("Unsupported GGStarRail backup workspace");
  return BackupEnvelopeSchema.parse({ ...envelope, payload });
}
