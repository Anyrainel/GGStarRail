import { z } from "zod";
import { AccountSnapshotSchema } from "@/domain/account/schemas";

// Account v3 had the same inventory/profile/source fields and optional
// achievementCompletion as v4, but no questProgress. Never fabricate an empty
// capture when migrating: absence means this account has not captured Quests.
const AccountSnapshotV3Schema = z
  .object({
    ...AccountSnapshotSchema.shape,
    schemaVersion: z.literal(3),
  })
  .omit({ questProgress: true })
  .strict();

// All persistence boundaries (hydration, backups, cloud snapshots and native
// account imports) share this transform. Canonical domain schemas remain v4.
export const MigratingAccountSnapshotSchema = z.union([
  AccountSnapshotSchema,
  AccountSnapshotV3Schema.transform((account, ctx) => {
    const result = AccountSnapshotSchema.safeParse({
      ...account,
      schemaVersion: 4,
    });
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue({ ...issue });
      return z.NEVER;
    }
    return result.data;
  }),
]);
