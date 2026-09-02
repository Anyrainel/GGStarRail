import { z } from "zod";
import { RelicCategorySchema, StableIdSchema } from "@/domain/account/schemas";

export const ScoreProfileSchema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80),
    statWeights: z.record(StableIdSchema, z.number().finite().min(0).max(1)),
    includeMainStat: z.boolean(),
    mainStatWeight: z.number().finite().min(0).max(1),
    gradeThresholds: z
      .object({
        s: z.number().finite().min(0).max(100),
        a: z.number().finite().min(0).max(100),
        b: z.number().finite().min(0).max(100),
        c: z.number().finite().min(0).max(100),
      })
      .strict()
      .refine(
        ({ s, a, b, c }) => s > a && a > b && b > c,
        "Grade thresholds must descend from S to C"
      ),
  })
  .strict();

export const CavernSetPlanSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("four-piece"),
      setId: StableIdSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal("two-plus-two"),
      setIds: z
        .tuple([StableIdSchema, StableIdSchema])
        .refine(([first, second]) => first !== second, {
          message: "A two-plus-two plan requires two different Cavern sets",
        }),
    })
    .strict(),
]);

export const PreferredMainStatsSchema = z
  .object({
    body: z.array(StableIdSchema).min(1),
    feet: z.array(StableIdSchema).min(1),
    planarSphere: z.array(StableIdSchema).min(1),
    linkRope: z.array(StableIdSchema).min(1),
  })
  .strict();

export const BuildConfigurationSchema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80),
    characterDefinitionId: StableIdSchema,
    scoreProfileId: StableIdSchema,
    cavern: CavernSetPlanSchema,
    planarSetId: StableIdSchema,
    preferredMainStats: PreferredMainStatsSchema,
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
    keepScoreAtLeast: z.number().finite().min(0).max(100),
    reviewScoreAtLeast: z.number().finite().min(0).max(100),
    protectLocked: z.boolean(),
    protectEquipped: z.boolean(),
  })
  .strict()
  .refine((rules) => rules.keepScoreAtLeast >= rules.reviewScoreAtLeast, {
    message: "keepScoreAtLeast must be at least reviewScoreAtLeast",
  });

export type ScoreProfile = z.infer<typeof ScoreProfileSchema>;
export type BuildConfiguration = z.infer<typeof BuildConfigurationSchema>;
export type CavernSetPlan = z.infer<typeof CavernSetPlanSchema>;
export type FilterClause = z.infer<typeof FilterClauseSchema>;
export type ComputedFilter = z.infer<typeof ComputedFilterSchema>;
export type TriageRules = z.infer<typeof TriageRulesSchema>;
