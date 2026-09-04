import { z } from "zod";
import {
  AccountSnapshotV1Schema,
  AccountSnapshotV2Schema,
  migrateAccountSnapshotV1,
  migrateAccountSnapshotV2,
  RelicSlotSchema,
  StableIdSchema,
} from "@/domain/account/schemas";
import {
  BuildConfigurationSchema,
  ComputedFilterSchema,
  ScoreProfileSchema,
  TriageRulesSchema,
} from "@/domain/build/schemas";
import {
  DEFAULT_WORKSPACE,
  type PersistedWorkspace,
  PersistedWorkspaceSchema,
} from "../schemas";

export const WORKSPACE_STORE_VERSION = 3;

// Store v2 used AccountSnapshot v2 and otherwise had the current build,
// score-profile, and triage shapes. Achievement completion did not exist.
const PersistedWorkspaceV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    account: AccountSnapshotV2Schema.nullable(),
    builds: z.array(BuildConfigurationSchema),
    scoreProfiles: z.array(ScoreProfileSchema),
    triageRules: TriageRulesSchema,
  })
  .strict();

// Store v1 used AccountSnapshot v1, raw-value ScoreProfiles, and a Build shape
// with `requiredSetIds`, all six slots in `preferredMainStats`, and cached
// `computedFilterIds`. Score thresholds were on that raw, unit-sensitive scale.
const ScoreProfileV1Schema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80),
    statWeights: z.record(StableIdSchema, z.number().finite()),
    includeMainStat: z.boolean(),
  })
  .strict();

const BuildConfigurationV1Schema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1).max(80),
    characterDefinitionId: StableIdSchema,
    scoreProfileId: StableIdSchema,
    preferredMainStats: z.record(RelicSlotSchema, z.array(StableIdSchema)),
    requiredSetIds: z.array(StableIdSchema).max(3),
    computedFilterIds: z.array(StableIdSchema),
  })
  .strict();

const PersistedWorkspaceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    account: AccountSnapshotV1Schema.nullable(),
    builds: z.array(BuildConfigurationV1Schema),
    scoreProfiles: z.array(ScoreProfileV1Schema),
    computedFilters: z.array(ComputedFilterSchema),
    triageRules: TriageRulesSchema,
  })
  .strict();

function preferred(
  input: z.infer<typeof BuildConfigurationV1Schema>["preferredMainStats"],
  slot: "body" | "feet" | "planarSphere" | "linkRope"
): string[] | null {
  const values = input[slot];
  return values && values.length > 0 ? [...values] : null;
}

function migrateV1(
  input: z.infer<typeof PersistedWorkspaceV1Schema>
): PersistedWorkspace {
  const seenProfileIds = new Set<string>();
  const scoreProfiles = input.scoreProfiles.flatMap((profile) => {
    if (seenProfileIds.has(profile.id)) return [];
    seenProfileIds.add(profile.id);
    return [
      {
        ...profile,
        statWeights: Object.fromEntries(
          Object.entries(profile.statWeights).map(([statId, weight]) => [
            statId,
            Math.min(1, Math.max(0, weight)),
          ])
        ),
        mainStatWeight: 0.5,
        gradeThresholds: { s: 50, a: 40, b: 30, c: 20 },
      },
    ];
  });
  // A v1 build is only migrated when its set split and every configurable
  // main-stat slot are recoverable. Older incomplete drafts are intentionally
  // dropped instead of inventing set/stat IDs that look like real catalog data.
  const profileIds = new Set(scoreProfiles.map(({ id }) => id));
  const seenBuildIds = new Set<string>();
  const builds = input.builds.flatMap((build) => {
    const sets = build.requiredSetIds;
    if (
      (sets.length !== 2 && sets.length !== 3) ||
      !profileIds.has(build.scoreProfileId) ||
      profileIds.has(build.id) ||
      seenBuildIds.has(build.id)
    ) {
      return [];
    }
    const [body, feet, planarSphere, linkRope] = [
      preferred(build.preferredMainStats, "body"),
      preferred(build.preferredMainStats, "feet"),
      preferred(build.preferredMainStats, "planarSphere"),
      preferred(build.preferredMainStats, "linkRope"),
    ];
    if (!body || !feet || !planarSphere || !linkRope) return [];

    const planarSetId = sets[sets.length - 1];
    const firstCavernSetId = sets[0];
    if (!planarSetId || !firstCavernSetId) return [];
    const secondCavernSetId = sets.length === 3 ? sets[1] : undefined;
    seenBuildIds.add(build.id);
    return [
      {
        id: build.id,
        name: build.name,
        characterDefinitionId: build.characterDefinitionId,
        scoreProfileId: build.scoreProfileId,
        cavern:
          secondCavernSetId && firstCavernSetId !== secondCavernSetId
            ? {
                mode: "two-plus-two" as const,
                setIds: [firstCavernSetId, secondCavernSetId] as [
                  string,
                  string,
                ],
              }
            : {
                mode: "four-piece" as const,
                setId: firstCavernSetId,
              },
        planarSetId,
        preferredMainStats: {
          body,
          feet,
          planarSphere,
          linkRope,
        },
      },
    ];
  });

  return PersistedWorkspaceSchema.parse({
    schemaVersion: 3,
    account: input.account ? migrateAccountSnapshotV1(input.account) : null,
    builds,
    scoreProfiles,
    triageRules: {
      keepScoreAtLeast: DEFAULT_WORKSPACE.triageRules.keepScoreAtLeast,
      reviewScoreAtLeast: DEFAULT_WORKSPACE.triageRules.reviewScoreAtLeast,
      protectLocked: input.triageRules.protectLocked,
      protectEquipped: input.triageRules.protectEquipped,
    },
  });
}

function migrateV2(
  input: z.infer<typeof PersistedWorkspaceV2Schema>
): PersistedWorkspace {
  return PersistedWorkspaceSchema.parse({
    ...input,
    schemaVersion: 3,
    account: input.account ? migrateAccountSnapshotV2(input.account) : null,
  });
}

export function parseVersionedWorkspace(input: unknown): PersistedWorkspace {
  const current = PersistedWorkspaceSchema.safeParse(input);
  if (current.success) return current.data;
  const versionTwo = PersistedWorkspaceV2Schema.safeParse(input);
  if (versionTwo.success) return migrateV2(versionTwo.data);
  const previous = PersistedWorkspaceV1Schema.safeParse(input);
  if (previous.success) return migrateV1(previous.data);
  throw new Error("Unsupported or invalid GGStarRail workspace schema");
}

export function migrateWorkspace(
  persistedState: unknown,
  persistedVersion: number
): PersistedWorkspace {
  if (persistedVersion === 1) {
    const previous = PersistedWorkspaceV1Schema.safeParse(persistedState);
    return previous.success
      ? migrateV1(previous.data)
      : structuredClone(DEFAULT_WORKSPACE);
  }

  if (persistedVersion === 2) {
    const previous = PersistedWorkspaceV2Schema.safeParse(persistedState);
    return previous.success
      ? migrateV2(previous.data)
      : structuredClone(DEFAULT_WORKSPACE);
  }

  if (persistedVersion !== WORKSPACE_STORE_VERSION) {
    return structuredClone(DEFAULT_WORKSPACE);
  }

  const parsed = PersistedWorkspaceSchema.safeParse(persistedState);
  return parsed.success ? parsed.data : structuredClone(DEFAULT_WORKSPACE);
}
