import { Eye, type LucideIcon, ShieldCheck, Trash2 } from "lucide-react";
import type { RelicTriageEvaluation } from "@/domain/build/evaluation";
import type { ScoreGrade } from "@/domain/build/scoring";
import type { TriageDecision, TriageReason } from "@/domain/build/triage";
import type { MessageKey } from "@/i18n/messages.en";

export const TRIAGE_DECISIONS: readonly TriageDecision[] = [
  "keep",
  "review",
  "salvage-review",
];

export interface TriageDecisionPresentation {
  labelKey: MessageKey;
  helpKey: MessageKey;
  icon: LucideIcon;
  /** Outline-badge tone from the existing tokens. */
  badgeClass: string;
}

export const TRIAGE_DECISION: Readonly<
  Record<TriageDecision, TriageDecisionPresentation>
> = {
  keep: {
    labelKey: "triage.keep",
    helpKey: "triage.help.keep",
    icon: ShieldCheck,
    badgeClass: "border-primary/40 bg-primary/15 text-primary",
  },
  review: {
    labelKey: "triage.review",
    helpKey: "triage.help.review",
    icon: Eye,
    badgeClass:
      "border-[hsl(var(--quality-gold)/0.45)] text-[hsl(var(--quality-gold))]",
  },
  "salvage-review": {
    labelKey: "triage.salvageReview",
    helpKey: "triage.help.salvageReview",
    icon: Trash2,
    badgeClass: "border-destructive/50 text-destructive",
  },
};

export const TRIAGE_REASON_KEY: Readonly<Record<TriageReason, MessageKey>> = {
  locked: "triage.reason.locked",
  equipped: "triage.reason.equipped",
  "lock-state-unknown": "triage.reason.unknownLock",
  "no-builds": "triage.reason.noBuilds",
  "build-match": "triage.reason.buildMatch",
  "no-build-match": "triage.reason.noBuildMatch",
  "keep-score": "triage.reason.keepScore",
  "review-score": "triage.reason.reviewScore",
  "low-score": "triage.reason.lowScore",
};

/** Grade filter buckets; a Relic with no matching build has no grade. */
export type TriageGradeKey = ScoreGrade | "none";

export const TRIAGE_GRADES: readonly TriageGradeKey[] = [
  "S",
  "A",
  "B",
  "C",
  "D",
  "none",
];

export function triageGradeKey(
  evaluation: Pick<RelicTriageEvaluation, "grade">
): TriageGradeKey {
  return evaluation.grade ?? "none";
}

export type TriageSortKey = "score" | "set" | "level";
export type TriageSortDirection = "asc" | "desc";

export const TRIAGE_SORTS: readonly {
  key: TriageSortKey;
  labelKey: MessageKey;
  /** The direction a first click selects. */
  initial: TriageSortDirection;
}[] = [
  { key: "score", labelKey: "triage.sort.score", initial: "desc" },
  { key: "set", labelKey: "triage.sort.set", initial: "asc" },
  { key: "level", labelKey: "triage.sort.level", initial: "desc" },
];
