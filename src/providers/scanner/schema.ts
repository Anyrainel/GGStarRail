import { z } from "zod";
import { AccountSnapshotSchema } from "@/domain/account/schemas";
import { assertNoSensitiveFields } from "@/lib/security";
import type { AccountImportDraft } from "../types";

const ScannerExportSchema = z
  .object({
    format: z.literal("ggstarrail-scanner-export"),
    schemaVersion: z.literal(1),
    sourceApp: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1),
      })
      .strict(),
    exportedAt: z.string().datetime(),
    account: AccountSnapshotSchema,
  })
  .strict();

export function parseScannerExport(input: unknown): AccountImportDraft {
  assertNoSensitiveFields(input);
  const parsed = ScannerExportSchema.parse(input);
  return {
    account: parsed.account,
    warnings: parsed.account.source.warnings,
  };
}
