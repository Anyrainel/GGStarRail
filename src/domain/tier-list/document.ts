import { z } from "zod";
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

export const TierDocumentSchema = z
  .object({
    kind: z.literal("ggstarrail.tier-list"),
    schemaVersion: z.literal(1),
    category: z.enum(["character", "light-cone", "relic-set"]),
    assignments: PriorityAssignmentsSchema,
    groupAssignments: RelicGroupAssignmentsSchema,
    presentation: TierPresentationSchema,
  })
  .strict();

export type TierPresentation = z.infer<typeof TierPresentationSchema>;
export type TierDocument = z.infer<typeof TierDocumentSchema>;
