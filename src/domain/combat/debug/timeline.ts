import type { CombatLog } from "../battle/log";

/**
 * Plain-text action timeline for tests and translation reviews: one line per
 * action with action value, cycle, unit, ability, Skill Points, and Energy.
 */
export function formatTimeline(log: CombatLog): string {
  return log.actions
    .map(
      (action) =>
        `${action.time.toFixed(1).padStart(7)} c${action.cycle} ${action.unitId.padEnd(28)} ${action.mode.padEnd(9)} ${action.abilityId.padEnd(14)} sp=${action.skillPointsAfter.toFixed(1)} en=${action.energyAfter.toFixed(1)}`
    )
    .join("\n");
}
