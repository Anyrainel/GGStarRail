import { z } from "zod";
import { StableIdSchema } from "@/domain/game-account/schemas";
import { type TeamPlan, TeamPlanSchema } from "./schemas";

export const TeamPresetSubscriptionSchema = z
  .object({
    presetId: StableIdSchema,
    baseline: z.array(TeamPlanSchema),
    deletedTeamIds: z.array(StableIdSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.baseline.map((team) => team.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate subscription baseline team",
      });
    if (new Set(value.deletedTeamIds).size !== value.deletedTeamIds.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate subscription tombstone",
      });
  });

export type TeamPresetSubscription = z.infer<
  typeof TeamPresetSubscriptionSchema
>;

function valuesEqual(first: unknown, second: unknown): boolean {
  if (first === second) return true;
  if (
    !first ||
    !second ||
    typeof first !== "object" ||
    typeof second !== "object"
  )
    return false;
  if (Array.isArray(first) || Array.isArray(second))
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((value, index) => valuesEqual(value, second[index]))
    );
  const firstRecord = first as Record<string, unknown>;
  const secondRecord = second as Record<string, unknown>;
  const keys = Object.keys(firstRecord);
  return (
    keys.length === Object.keys(secondRecord).length &&
    keys.every(
      (key) =>
        Object.hasOwn(secondRecord, key) &&
        valuesEqual(firstRecord[key], secondRecord[key])
    )
  );
}

/** Whole-team edits are authored overrides, while untouched rows follow the file.
 * Keep tombstones even when a row leaves the file so reintroductions stay deleted. */
export function reconcileTeamPreset(
  current: readonly TeamPlan[],
  subscription: TeamPresetSubscription,
  incoming: readonly TeamPlan[]
): { teams: TeamPlan[]; subscription: TeamPresetSubscription } {
  const oldById = new Map(subscription.baseline.map((team) => [team.id, team]));
  const nextById = new Map(incoming.map((team) => [team.id, team]));
  const currentById = new Map(current.map((team) => [team.id, team]));
  const deleted = new Set(subscription.deletedTeamIds);
  for (const team of subscription.baseline)
    if (!currentById.has(team.id)) deleted.add(team.id);
  const resolved = new Map<string, TeamPlan>();
  for (const team of current) {
    const old = oldById.get(team.id);
    if (!old || !valuesEqual(team, old)) resolved.set(team.id, team);
    else if (nextById.has(team.id) && !deleted.has(team.id))
      resolved.set(team.id, nextById.get(team.id)!);
  }
  for (const team of incoming)
    if (!resolved.has(team.id) && !deleted.has(team.id))
      resolved.set(team.id, team);

  // Preserve user ordering, including custom rows. Untouched ordering follows
  // the latest file; newly added preset rows append when order was authored.
  const oldOrder = subscription.baseline
    .filter((team) => currentById.has(team.id))
    .map((team) => team.id);
  const currentPresetOrder = current
    .filter((team) => oldById.has(team.id))
    .map((team) => team.id);
  const custom = current.some((team) => !oldById.has(team.id));
  const authoredOrder =
    custom || JSON.stringify(oldOrder) !== JSON.stringify(currentPresetOrder);
  const ids = authoredOrder
    ? [...current.map((team) => team.id), ...incoming.map((team) => team.id)]
    : [...incoming.map((team) => team.id), ...current.map((team) => team.id)];
  const teams = [...new Set(ids)].flatMap((id) =>
    resolved.has(id) ? [resolved.get(id)!] : []
  );
  return structuredClone({
    teams,
    subscription: {
      presetId: subscription.presetId,
      baseline: [...incoming],
      deletedTeamIds: [...deleted],
    },
  });
}
