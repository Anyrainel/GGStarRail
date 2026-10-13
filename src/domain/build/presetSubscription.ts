import { z } from "zod";
import { CharacterLightConeChoicesSchema } from "./lightConeChoices";
import {
  BuildConfigurationSchema,
  ScoreProfileSchema,
  TriageRulesSchema,
} from "./schemas";

export const BuildPresetSnapshotSchema = z
  .object({
    builds: z.array(BuildConfigurationSchema),
    scoreProfiles: z.array(ScoreProfileSchema),
    characterLightConeIds: CharacterLightConeChoicesSchema,
    triageRules: TriageRulesSchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    const ids = new Set<string>();
    for (const [field, entries] of [
      ["builds", snapshot.builds],
      ["scoreProfiles", snapshot.scoreProfiles],
    ] as const) {
      for (const [index, entry] of entries.entries()) {
        if (ids.has(entry.id))
          context.addIssue({
            code: "custom",
            message: "Duplicate preset entry ID",
            path: [field, index, "id"],
          });
        ids.add(entry.id);
      }
    }
    const profiles = new Set(
      snapshot.scoreProfiles.map((profile) => profile.id)
    );
    for (const [index, build] of snapshot.builds.entries()) {
      if (!profiles.has(build.scoreProfileId))
        context.addIssue({
          code: "custom",
          message: "Missing preset Score Profile",
          path: ["builds", index, "scoreProfileId"],
        });
    }
  });

export const BuildPresetSubscriptionSchema = z
  .object({
    presetId: z.string().min(1),
    baseline: BuildPresetSnapshotSchema,
    deletedBuildIds: z
      .array(z.string().min(1))
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate deleted preset ID"
      ),
  })
  .strict();

export type BuildPresetSnapshot = z.infer<typeof BuildPresetSnapshotSchema>;
export type BuildPresetSubscription = z.infer<
  typeof BuildPresetSubscriptionSchema
>;

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length &&
      left.every((item, i) => equal(item, right[i]))
    );
  if (left && right && typeof left === "object" && typeof right === "object") {
    const a = Object.entries(left),
      b = Object.entries(right);
    return (
      a.length === b.length &&
      a.every(([key, value]) =>
        equal(value, (right as Record<string, unknown>)[key])
      )
    );
  }
  return false;
}

function updateItems<T extends { id: string }>(
  current: T[],
  baseline: T[],
  next: T[],
  deleted = new Set<string>()
): T[] {
  const before = new Map(baseline.map((item) => [item.id, item]));
  const incoming = new Map(next.map((item) => [item.id, item]));
  const currentIds = new Set(current.map((item) => item.id));
  const output = current.flatMap((item) => {
    const old = before.get(item.id);
    if (!old || !equal(item, old)) return [item];
    const fresh = incoming.get(item.id);
    return fresh ? [fresh] : [];
  });
  for (const item of next) {
    if (
      !currentIds.has(item.id) &&
      !before.has(item.id) &&
      !deleted.has(item.id)
    )
      output.push(item);
  }
  const currentPresetOrder = current
    .filter((item) => before.has(item.id))
    .map((item) => item.id);
  const baselinePresentOrder = baseline
    .filter((item) => currentIds.has(item.id))
    .map((item) => item.id);
  const hasCustomEntries = current.some((item) => !before.has(item.id));
  if (!hasCustomEntries && equal(currentPresetOrder, baselinePresentOrder)) {
    const positions = new Map(next.map((item, index) => [item.id, index]));
    output.sort(
      (left, right) =>
        (positions.get(left.id) ?? next.length) -
        (positions.get(right.id) ?? next.length)
    );
  }
  return output;
}

/** Update untouched preset entries while retaining edits, custom entries, order and tombstones. */
export function reconcileBuildPreset(
  current: BuildPresetSnapshot,
  subscription: BuildPresetSubscription,
  next: BuildPresetSnapshot
) {
  const baseline = subscription.baseline;
  const deleted = new Set(subscription.deletedBuildIds);
  for (const item of baseline.builds)
    if (!current.builds.some((build) => build.id === item.id))
      deleted.add(item.id);
  const builds = updateItems(
    current.builds,
    baseline.builds,
    next.builds,
    deleted
  );
  const scoreProfiles = updateItems(
    current.scoreProfiles,
    baseline.scoreProfiles,
    next.scoreProfiles
  );
  // A locally edited card can still refer to a profile removed upstream.
  for (const build of builds) {
    if (!scoreProfiles.some((profile) => profile.id === build.scoreProfileId)) {
      const old = current.scoreProfiles.find(
        (profile) => profile.id === build.scoreProfileId
      );
      if (old) scoreProfiles.push(old);
    }
  }
  const characterLightConeIds = { ...current.characterLightConeIds };
  for (const id of new Set([
    ...Object.keys(baseline.characterLightConeIds),
    ...Object.keys(next.characterLightConeIds),
  ])) {
    if (
      equal(
        current.characterLightConeIds[id],
        baseline.characterLightConeIds[id]
      )
    ) {
      if (next.characterLightConeIds[id])
        characterLightConeIds[id] = next.characterLightConeIds[id]!;
      else delete characterLightConeIds[id];
    }
  }
  return {
    builds,
    scoreProfiles,
    characterLightConeIds,
    triageRules: equal(current.triageRules, baseline.triageRules)
      ? next.triageRules
      : current.triageRules,
    buildPresetSubscription: {
      presetId: subscription.presetId,
      baseline: structuredClone({
        builds: next.builds,
        scoreProfiles: next.scoreProfiles,
        characterLightConeIds: next.characterLightConeIds,
        triageRules: next.triageRules,
      }),
      deletedBuildIds: [...deleted],
    },
  };
}
