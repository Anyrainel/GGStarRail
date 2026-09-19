import { canonicalCharacterId } from "@/domain/characterIdentity";
import { PRIORITY_TIERS } from "./constants";
import type { PriorityAssignments, PriorityPlacement } from "./types";

/** Gender variants share one rank. Keep the higher tier, then earlier position. */
export function canonicalCharacterAssignments(
  assignments: PriorityAssignments
): PriorityAssignments {
  const result: Record<string, PriorityPlacement> = {};
  for (const [sourceId, placement] of Object.entries(assignments)) {
    const id = canonicalCharacterId(sourceId);
    const previous = result[id];
    if (
      !previous ||
      PRIORITY_TIERS.indexOf(placement.tier) <
        PRIORITY_TIERS.indexOf(previous.tier) ||
      (placement.tier === previous.tier &&
        placement.position < previous.position)
    )
      result[id] = placement;
  }
  return result;
}
