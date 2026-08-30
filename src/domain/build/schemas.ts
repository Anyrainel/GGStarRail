import { z } from "zod";
import {
  RelicCategorySchema,
  RelicSlotSchema,
  StableIdSchema,
} from "@/domain/account/schemas";

export const ScoreProfileSchema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80),
    statWeights: z.record(StableIdSchema, z.number().finite()),
    includeMainStat: z.boolean(),
  })
  .strict();

export const BuildConfigurationSchema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80),
    characterDefinitionId: StableIdSchema,
    scoreProfileId: StableIdSchema,
    preferredMainStats: z.record(RelicSlotSchema, z.array(StableIdSchema)),
    requiredSetIds: z.array(StableIdSchema).max(3),
    computedFilterIds: z.array(StableIdSchema),
  })
  .strict();

const NumericFilterFieldSchema = z.enum(["rarity", "level", "score"]);
const BooleanFilterFieldSchema = z.enum(["locked", "equipped"]);

const NumericFilterClauseSchema = z
  .object({
    field: NumericFilterFieldSchema,
    operation: z.enum(["eq", "gte", "lte"]),
    value: z.number().finite(),
  })
  .strict();

const BooleanFilterClauseSchema = z
  .object({
    field: BooleanFilterFieldSchema,
    operation: z.literal("eq"),
    value: z.boolean(),
  })
  .strict();

const CategoryFilterClauseSchema = z
  .object({
    field: z.literal("category"),
    operation: z.literal("eq"),
    value: RelicCategorySchema,
  })
  .strict();

export const FilterClauseSchema = z.union([
  NumericFilterClauseSchema,
  BooleanFilterClauseSchema,
  CategoryFilterClauseSchema,
]);

export const ComputedFilterSchema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80),
    mode: z.enum(["all", "any"]),
    clauses: z.array(FilterClauseSchema).min(1),
  })
  .strict();

export const TriageRulesSchema = z
  .object({
    keepScoreAtLeast: z.number().finite(),
    reviewScoreAtLeast: z.number().finite(),
    protectLocked: z.boolean(),
    protectEquipped: z.boolean(),
  })
  .strict()
  .refine((rules) => rules.keepScoreAtLeast >= rules.reviewScoreAtLeast, {
    message: "keepScoreAtLeast must be at least reviewScoreAtLeast",
  });

export type ScoreProfile = z.infer<typeof ScoreProfileSchema>;
export type BuildConfiguration = z.infer<typeof BuildConfigurationSchema>;
export type FilterClause = z.infer<typeof FilterClauseSchema>;
export type ComputedFilter = z.infer<typeof ComputedFilterSchema>;
export type TriageRules = z.infer<typeof TriageRulesSchema>;
