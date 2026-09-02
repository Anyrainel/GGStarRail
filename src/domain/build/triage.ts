import type { TriageRules } from "./schemas";

export type TriageDecision = "keep" | "review" | "salvage-review";

export interface TriageContext {
  score: number;
  locked: boolean | null;
  equipped: boolean;
  configuredBuildCount: number;
  matchingBuildCount: number;
}

export type TriageReason =
  | "locked"
  | "equipped"
  | "lock-state-unknown"
  | "no-builds"
  | "build-match"
  | "no-build-match"
  | "keep-score"
  | "review-score"
  | "low-score";

export interface TriageResult {
  decision: TriageDecision;
  reasons: TriageReason[];
}

export function triageRelic(
  context: TriageContext,
  rules: TriageRules
): TriageResult {
  if (rules.protectEquipped && context.equipped) {
    return { decision: "keep", reasons: ["equipped"] };
  }
  if (rules.protectLocked && context.locked === true) {
    return { decision: "keep", reasons: ["locked"] };
  }
  if (context.locked === null) {
    return { decision: "review", reasons: ["lock-state-unknown"] };
  }
  if (context.configuredBuildCount === 0) {
    return { decision: "review", reasons: ["no-builds"] };
  }
  if (context.matchingBuildCount === 0) {
    return { decision: "salvage-review", reasons: ["no-build-match"] };
  }
  if (context.score >= rules.keepScoreAtLeast) {
    return { decision: "keep", reasons: ["build-match", "keep-score"] };
  }
  if (context.score >= rules.reviewScoreAtLeast) {
    return { decision: "review", reasons: ["build-match", "review-score"] };
  }
  return {
    decision: "salvage-review",
    reasons: ["build-match", "low-score"],
  };
}
