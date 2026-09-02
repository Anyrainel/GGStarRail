import { z } from "zod";

export const ResourceActionKindSchema = z.enum([
  "level-up",
  "synthesize",
  "reroll",
]);

export const ResourceSuggestionPrioritySchema = z.enum([
  "high",
  "medium",
  "low",
]);

const ResourceActionBooleanRecordSchema = z
  .object({
    "level-up": z.boolean(),
    synthesize: z.boolean(),
    reroll: z.boolean(),
  })
  .strict();

const ResourceActionThresholdRecordSchema = z
  .object({
    "level-up": z.number().finite().min(0).max(100),
    synthesize: z.number().finite().min(0).max(100),
    reroll: z.number().finite().min(0).max(100),
  })
  .strict();

export const ResourceSettingsSchema = z
  .object({
    enabledActions: ResourceActionBooleanRecordSchema,
    minimumScoreGap: ResourceActionThresholdRecordSchema,
  })
  .strict();

export type ResourceActionKind = z.infer<typeof ResourceActionKindSchema>;
export type ResourceSuggestionPriority = z.infer<
  typeof ResourceSuggestionPrioritySchema
>;
export type ResourceSettings = z.infer<typeof ResourceSettingsSchema>;

export const DEFAULT_RESOURCE_SETTINGS: ResourceSettings = {
  enabledActions: {
    "level-up": true,
    synthesize: true,
    reroll: true,
  },
  minimumScoreGap: {
    "level-up": 0,
    synthesize: 15,
    reroll: 8,
  },
};
