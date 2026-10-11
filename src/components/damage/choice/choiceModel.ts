import type { CompareEntry } from "@/lib/combat/jobs";
import {
  type MemberPreview,
  type PlanSets,
  planSets,
} from "@/lib/combat/teamPreview";
import { equippedSetSummary } from "@/lib/relicPresentation";

/** What the Choice Results card compares: Light Cones or Relic set plans. */
export type ChoiceMode = "lightCones" | "setPlans";

export const CHOICE_MODES: readonly ChoiceMode[] = ["lightCones", "setPlans"];

/** Rankings by team slot for one mode, plus the slots whose job failed. */
export interface ChoiceResult {
  readonly rankings: Readonly<Record<number, readonly CompareEntry[]>>;
  readonly failed: readonly number[];
}

/** Rows within 1% of the best candidate are highlighted, five at most. */
const TOP_SHARE = 0.99;
const MAX_TOP_ROWS = 5;

/** How many leading rows (already sorted best first) are top rows. */
export function topRowCount(entries: readonly CompareEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.relative + 1e-9 < TOP_SHARE) break;
    count += 1;
  }
  return Math.min(count, MAX_TOP_ROWS);
}

/** A 2+2 of the same set is a 4-piece plan. */
function normalizedCavern(cavern: readonly string[]): readonly string[] {
  const [first, second] = cavern;
  if (!first) return [];
  if (!second || second === first) return [first];
  return [first, second].sort();
}

/** The sets a ranked plan uses, with a repeated 2+2 set folded into 4-piece. */
export function entrySets(entry: CompareEntry): PlanSets | null {
  if (!entry.plan) return null;
  const sets = planSets(entry.plan);
  return { cavern: normalizedCavern(sets.cavern), planar: sets.planar };
}

/** Active Cavern bonuses (a 4-piece, or 2-piece each) and the Planar set. */
export interface SetBonuses {
  readonly cavern: readonly {
    readonly setId: string;
    readonly tier: 2 | 4;
  }[];
  readonly planar: string | null;
}

function planBonuses(sets: PlanSets): SetBonuses {
  const cavern = normalizedCavern(sets.cavern);
  return {
    cavern: cavern.map((setId) => ({
      setId,
      tier: cavern.length === 1 ? 4 : 2,
    })),
    planar: sets.planar,
  };
}

/** The bonuses a ranked plan activates. */
export function entryBonuses(entry: CompareEntry): SetBonuses | null {
  const sets = entrySets(entry);
  return sets ? planBonuses(sets) : null;
}

/**
 * The bonuses a member uses now: what its own Relics activate when it wears
 * them (a lone 2-piece beside off-set pieces included), otherwise its
 * ideal-Relic plan.
 */
export function currentBonuses(member: MemberPreview): SetBonuses {
  if (member.relicSource === "equipped") {
    const summary = equippedSetSummary(member.equippedRelics);
    return {
      cavern: summary.cavern.map(({ setId, tier }) => ({ setId, tier })),
      planar: summary.planar?.setId ?? null,
    };
  }
  return planBonuses(member.plannedSets);
}

function bonusSignature(bonuses: SetBonuses): string {
  const cavern = bonuses.cavern
    .map((bonus) => `${bonus.setId}:${bonus.tier}`)
    .sort()
    .join("+");
  return `${cavern}|${bonuses.planar ?? ""}`;
}

/** Whether a ranked candidate is what the member uses now. */
export function isCurrentEntry(
  entry: CompareEntry,
  member: MemberPreview
): boolean {
  if (entry.lightCone) return entry.lightCone.id === member.lightCone?.id;
  const bonuses = entryBonuses(entry);
  return (
    bonuses !== null &&
    bonusSignature(bonuses) === bonusSignature(currentBonuses(member))
  );
}

/** A stable row key for a ranked candidate. */
export function entryKey(entry: CompareEntry): string {
  if (entry.lightCone)
    return `lc:${entry.lightCone.id}:${entry.lightCone.superimposition}`;
  const sets = entrySets(entry);
  return `plan:${sets?.cavern.join("+") ?? ""}|${sets?.planar ?? ""}`;
}

/**
 * Distinct candidates across every member in a result; members of one Path
 * rank the same Light Cones, which count once.
 */
export function candidateCount(result: ChoiceResult | null): number {
  if (!result) return 0;
  return new Set(Object.values(result.rankings).flat().map(entryKey)).size;
}
