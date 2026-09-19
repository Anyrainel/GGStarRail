import { z } from "zod";
import { canonicalCharacterAssignments } from "./characterAssignments";
import { PRIORITY_ROWS } from "./constants";
import {
  PriorityAssignmentsSchema,
  RelicGroupAssignmentsSchema,
} from "./schemas";

export const TierPresentationSchema = z
  .object({
    title: z.string().max(160),
    labels: z.partialRecord(z.enum(PRIORITY_ROWS), z.string().max(40)),
    hidden: z.array(z.enum(PRIORITY_ROWS)),
  })
  .strict();

const TierDocumentFieldsSchema = z
  .object({
    kind: z.literal("ggstarrail.tier-list"),
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    category: z.enum(["character", "light-cone", "relic-set"]),
    assignments: PriorityAssignmentsSchema,
    groupAssignments: RelicGroupAssignmentsSchema,
    presentation: TierPresentationSchema,
  })
  .strict();

// JSON imports and library hydration share the same v1 -> v2 identity transform.
export const TierDocumentSchema = TierDocumentFieldsSchema.transform(
  (document) => ({
    ...document,
    schemaVersion: 2 as const,
    assignments:
      document.category === "character"
        ? canonicalCharacterAssignments(document.assignments)
        : document.assignments,
  })
);

export type TierPresentation = z.infer<typeof TierPresentationSchema>;
export type TierDocument = z.infer<typeof TierDocumentSchema>;
