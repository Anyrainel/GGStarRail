import type { useI18n } from "@/i18n/I18nContext";
import type { TeamPlan } from "@/stores/teamSchemas";

type Translate = ReturnType<typeof useI18n>["t"];

/** The fallback name: "Team {n}" by list position. */
export function teamPlaceholderName(
  team: TeamPlan,
  teams: readonly TeamPlan[],
  t: Translate
): string {
  const index = teams.findIndex((entry) => entry.id === team.id);
  return t("combat.team.unnamed", {
    index: (index < 0 ? teams.length : index) + 1,
  });
}

/** The saved name, or a numbered placeholder by list position. */
export function teamDisplayName(
  team: TeamPlan,
  teams: readonly TeamPlan[],
  t: Translate
): string {
  return team.name ?? teamPlaceholderName(team, teams, t);
}

/** Index of the first empty slot, or -1 when the team is full. */
export function firstEmptySlot(team: TeamPlan): number {
  return team.members.indexOf(null);
}

/** Index of the last filled slot, or -1 when the team is empty. */
export function lastFilledSlot(team: TeamPlan): number {
  for (let index = team.members.length - 1; index >= 0; index -= 1)
    if (team.members[index]) return index;
  return -1;
}

export function teamIsEmpty(team: TeamPlan): boolean {
  return team.members.every((member) => member === null);
}
