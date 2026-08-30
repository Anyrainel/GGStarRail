import type { RelicFilterContext } from "./filters";
import type { TriageRules } from "./schemas";

export type TriageDecision = "keep" | "review" | "salvage-candidate";

export interface TriageResult {
  decision: TriageDecision;
  reasons: Array<
    "locked" | "equipped" | "keep-score" | "review-score" | "low-score"
  >;
}

export function triageRelic(
  context: RelicFilterContext,
  rules: TriageRules
): TriageResult {
  if (rules.protectLocked && context.locked) {
    return { decision: "keep", reasons: ["locked"] };
  }
  if (rules.protectEquipped && context.equipped) {
    return { decision: "keep", reasons: ["equipped"] };
  }
  if (context.score >= rules.keepScoreAtLeast) {
    return { decision: "keep", reasons: ["keep-score"] };
  }
  if (context.score >= rules.reviewScoreAtLeast) {
    return { decision: "review", reasons: ["review-score"] };
  }
  return { decision: "salvage-candidate", reasons: ["low-score"] };
}
