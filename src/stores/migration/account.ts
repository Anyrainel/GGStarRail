import { z } from "zod";
import {
  AccountSnapshotSchema,
  AccountSnapshotV3Schema,
  migrateAccountSnapshotV3,
} from "@/domain/account/schemas";

// Published account v4 uses catalog trace IDs without Quest snapshots. The
// unpublished Quest branch also used v4, with legacy trace keys and optional
// questProgress. Accept both shapes and preserve captured Quests verbatim.
const AccountSnapshotV4Schema = z
  .object({
    ...AccountSnapshotV3Schema.shape,
    schemaVersion: z.literal(4),
    questProgress: AccountSnapshotSchema.shape.questProgress,
  })
  .strict();

export const MigratingAccountSnapshotSchema = z.union([
  AccountSnapshotSchema,
  z
    .union([AccountSnapshotV3Schema, AccountSnapshotV4Schema])
    .transform((account, ctx) => {
      const {
        schemaVersion: _version,
        questProgress,
        ...previous
      } = {
        questProgress: undefined,
        ...account,
      };
      const legacy = AccountSnapshotV3Schema.safeParse({
        ...previous,
        schemaVersion: 3,
      });
      if (!legacy.success) {
        for (const issue of legacy.error.issues) ctx.addIssue({ ...issue });
        return z.NEVER;
      }
      const migrated = migrateAccountSnapshotV3(legacy.data);
      return AccountSnapshotSchema.parse({
        ...migrated,
        ...(questProgress ? { questProgress } : {}),
      });
    }),
]);
