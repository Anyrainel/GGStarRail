import type { RelicCategory } from "@/domain/account/schemas";
import type { ComputedFilter, FilterClause } from "./schemas";

export interface RelicFilterContext {
  rarity: number;
  level: number;
  score: number;
  locked: boolean;
  equipped: boolean;
  category: RelicCategory;
}

function matchesClause(
  context: RelicFilterContext,
  clause: FilterClause
): boolean {
  const actual = context[clause.field];
  if (clause.operation === "eq") return actual === clause.value;
  if (typeof actual !== "number") return false;
  if (clause.operation === "gte") return actual >= clause.value;
  return actual <= clause.value;
}

export function matchesComputedFilter(
  context: RelicFilterContext,
  filter: ComputedFilter
): boolean {
  const matches = filter.clauses.map((clause) =>
    matchesClause(context, clause)
  );
  return filter.mode === "all" ? matches.every(Boolean) : matches.some(Boolean);
}
