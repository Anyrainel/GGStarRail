import { PRIORITY_TIERS } from "./constants";
import type { PriorityAssignments } from "./types";

/** Ranked Characters stay ahead of the unassigned pool in either direction. */
export function compareCharacterPriority(
  leftId: string,
  rightId: string,
  assignments: PriorityAssignments,
  direction: "ascending" | "descending"
): number {
  const left = assignments[leftId];
  const right = assignments[rightId];
  if (!left || !right) return Number(!!right) - Number(!!left);
  const comparison =
    PRIORITY_TIERS.indexOf(left.tier) - PRIORITY_TIERS.indexOf(right.tier) ||
    left.position - right.position;
  return comparison * (direction === "descending" ? 1 : -1);
}
