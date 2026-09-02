import { z } from "zod";
import { BACKUP_IDENTITY } from "@/config/identity";
import { parseVersionedWorkspace } from "@/stores/migration/workspace";
import {
  type PersistedWorkspace,
  PersistedWorkspaceSchema,
} from "@/stores/schemas";
import { assertNoSensitiveFields } from "./security";

export const BackupEnvelopeSchema = z
  .object({
    product: z.literal(BACKUP_IDENTITY.product),
    kind: z.literal(BACKUP_IDENTITY.kind),
    schemaVersion: z.literal(BACKUP_IDENTITY.schemaVersion),
    createdAt: z.string().datetime(),
    payload: PersistedWorkspaceSchema,
  })
  .strict();

export type BackupEnvelope = z.infer<typeof BackupEnvelopeSchema>;

const BackupEnvelopeContainerSchema = z
  .object({
    product: z.literal(BACKUP_IDENTITY.product),
    kind: z.literal(BACKUP_IDENTITY.kind),
    schemaVersion: z.literal(BACKUP_IDENTITY.schemaVersion),
    createdAt: z.string().datetime(),
    payload: z.unknown(),
  })
  .strict();

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
  const envelope = BackupEnvelopeContainerSchema.parse(parsed);
  return BackupEnvelopeSchema.parse({
    ...envelope,
    payload: parseVersionedWorkspace(envelope.payload),
  });
}
