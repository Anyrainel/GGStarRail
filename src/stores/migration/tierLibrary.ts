import { z } from "zod";
import { TierDocumentSchema } from "@/domain/tier-list/document";

// Library v1 used the same container with v1 documents holding gender-specific
// ranks. Parsing each document upgrades it to a canonical v2 ranking.
export const TierLibrarySchema = z
  .object({
    documents: z.record(z.string(), TierDocumentSchema),
    active: z.partialRecord(
      z.enum(["character", "light-cone", "relic-set"]),
      z.string()
    ),
  })
  .strict();

export function migrateTierLibrary(
  persisted: unknown,
  version: number
): z.infer<typeof TierLibrarySchema> {
  const parsed = version === 1 ? TierLibrarySchema.safeParse(persisted) : null;
  return parsed?.success ? parsed.data : { documents: {}, active: {} };
}
