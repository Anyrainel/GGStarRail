import { describe, expect, it } from "vitest";
import { AccountSnapshotSchema, RelicSchema } from "@/domain/account/schemas";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import {
  evaluateAccountTriage,
  evaluateEquippedBuild,
  recommendBuildLoadout,
} from "@/domain/build/evaluation";
import {
  deriveBuildFilters,
  evaluateBuildFilter,
} from "@/domain/build/filters";
import { triageRelic } from "@/domain/build/triage";
import { createBuildWorkspaceBundle } from "@/lib/buildBundle";
import {
  createRelicScoringContext,
  loadBuildReferences,
} from "@/lib/buildReferences";
import { createDemoAccount } from "@/lib/demoAccount";
import {
  createManagerInstructionEnvelope,
  createManagerInstructionPreview,
  serializeManagerInstructionEnvelope,
  summarizeManagerInstructionActionability,
} from "@/lib/managerInstructions";
import { HSR_REFERENCE_MANIFEST } from "@/providers/gilore/catalog";
import { DEFAULT_WORKSPACE, PersistedWorkspaceSchema } from "@/stores/schemas";
import { makeRelic } from "./fixtures";

async function setupBuild() {
  const [account, references] = await Promise.all([
    createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
    loadBuildReferences(),
  ]);
  const ownedCharacter = account.characters[0];
  if (!ownedCharacter) throw new Error("Demo character missing");
  const character = references.characters.byId.get(ownedCharacter.definitionId);
  if (!character) throw new Error("Character reference missing");
  const profile = createCharacterScoreProfile(
    character,
    references.progression,
    "March 7th score",
    "score:1001"
  );
  const build = createCharacterBuild(
    character,
    ownedCharacter.key,
    account.relics,
    references.relicSets.values,
    references.properties,
    references.progression,
    profile.id,
    "March 7th build",
    "build:1001"
  );
  const context = createRelicScoringContext(references);
  return { account, references, character, profile, build, context };
}

describe("end-to-end build workspace domain", () => {
  it("derives generated defaults and discounts flat stats by source roll units", async () => {
    const { profile, build } = await setupBuild();
    const percentWeight = profile.statWeights.AttackAddedRatio ?? 0;
    const flatWeight = profile.statWeights.AttackDelta ?? 0;
    expect(percentWeight).toBeGreaterThan(0);
    expect(flatWeight / percentWeight).toBeCloseTo(1.728 / 3.888, 5);
    expect(build.cavern.mode).toBe("four-piece");
    expect(build.preferredMainStats.body.length).toBeGreaterThan(0);
    expect("head" in build.preferredMainStats).toBe(false);
  });

  it("derives six build filters with profile-driven stat requirements", async () => {
    const { build, profile } = await setupBuild();
    const filters = deriveBuildFilters(build, profile);
    expect(filters).toHaveLength(6);
    expect(filters.every((filter) => filter.minimumScore === 20)).toBe(true);
    expect(filters[0]?.mainStatIds).toEqual(["HPDelta"]);
    expect(filters[1]?.mainStatIds).toEqual(["AttackDelta"]);
    expect(filters.some((filter) => filter.weightedStatIds.length > 0)).toBe(
      true
    );
  });

  it("never requires an accepted main stat again as a substat", async () => {
    const { build, profile } = await setupBuild();
    const tailoredProfile = {
      ...profile,
      statWeights: {
        ...profile.statWeights,
        HPDelta: 1,
        AttackDelta: 1,
        CriticalChanceBase: 1,
        SpeedDelta: 1,
      },
    };
    const tailoredBuild = {
      ...build,
      preferredMainStats: {
        ...build.preferredMainStats,
        body: ["CriticalChanceBase"],
        feet: ["SpeedDelta"],
      },
    };
    const bySlot = new Map(
      deriveBuildFilters(tailoredBuild, tailoredProfile).map((filter) => [
        filter.slot,
        filter,
      ])
    );

    expect(bySlot.get("head")?.weightedStatIds).not.toContain("HPDelta");
    expect(bySlot.get("hands")?.weightedStatIds).not.toContain("AttackDelta");
    expect(bySlot.get("body")?.weightedStatIds).not.toContain(
      "CriticalChanceBase"
    );
    expect(bySlot.get("feet")?.weightedStatIds).not.toContain("SpeedDelta");
  });

  it("keeps the opposite crit stat when a Body accepts CR or CD mains", async () => {
    const { build, profile } = await setupBuild();
    const tailoredProfile = {
      ...profile,
      statWeights: {
        CriticalChanceBase: 1,
        CriticalDamageBase: 1,
        SpeedDelta: 0.8,
      },
    };
    const tailoredBuild = {
      ...build,
      preferredMainStats: {
        ...build.preferredMainStats,
        body: ["CriticalChanceBase", "CriticalDamageBase"],
      },
    };
    const bodyFilter = deriveBuildFilters(tailoredBuild, tailoredProfile).find(
      (filter) => filter.slot === "body"
    );
    if (!bodyFilter) throw new Error("Body filter missing");
    const bodySetId = bodyFilter.setIds[0];
    if (!bodySetId) throw new Error("Body set missing");

    expect(bodyFilter.weightedStatIds).toEqual([
      "CriticalChanceBase",
      "CriticalDamageBase",
      "SpeedDelta",
    ]);
    expect(
      evaluateBuildFilter(
        makeRelic({
          slot: "body",
          setId: bodySetId,
          mainStat: { statId: "CriticalChanceBase", value: 32.4 },
          substats: [
            { statId: "CriticalDamageBase", value: 12.9 },
            { statId: "SpeedDelta", value: 5 },
          ],
        }),
        bodyFilter,
        100
      ).matches
    ).toBe(true);
    expect(
      evaluateBuildFilter(
        makeRelic({
          slot: "body",
          setId: bodySetId,
          mainStat: { statId: "CriticalDamageBase", value: 64.8 },
          substats: [
            { statId: "CriticalChanceBase", value: 6.4 },
            { statId: "SpeedDelta", value: 5 },
          ],
        }),
        bodyFilter,
        100
      ).matches
    ).toBe(true);
  });

  it("scores equipped builds and enforces aggregate two-plus-two allocation", async () => {
    const { account, profile, build, context } = await setupBuild();
    const equipped = evaluateEquippedBuild(account, build, profile, context);
    expect(equipped.complete).toBe(true);
    expect(equipped.cavernSetComplete).toBe(true);
    expect(equipped.planarSetComplete).toBe(true);
    expect(equipped.averageScore).not.toBeNull();

    const cavernSetIds = [
      ...new Set(
        account.relics
          .filter(
            (relic) =>
              relic.slot !== "planarSphere" && relic.slot !== "linkRope"
          )
          .map((relic) => relic.setId)
      ),
    ];
    expect(cavernSetIds.length).toBeGreaterThanOrEqual(2);
    const firstSet = cavernSetIds[0];
    const secondSet = cavernSetIds[1];
    if (!firstSet || !secondSet) throw new Error("Two Cavern sets missing");
    const mixedBuild = {
      ...build,
      cavern: {
        mode: "two-plus-two" as const,
        setIds: [firstSet, secondSet] as [string, string],
      },
      preferredMainStats: {
        body: account.relics
          .filter((relic) => relic.slot === "body")
          .map((relic) => relic.mainStat.statId),
        feet: account.relics
          .filter((relic) => relic.slot === "feet")
          .map((relic) => relic.mainStat.statId),
        planarSphere: account.relics
          .filter((relic) => relic.slot === "planarSphere")
          .map((relic) => relic.mainStat.statId),
        linkRope: account.relics
          .filter((relic) => relic.slot === "linkRope")
          .map((relic) => relic.mainStat.statId),
      },
    };
    const allocationOnlyProfile = {
      ...profile,
      statWeights: {},
      includeMainStat: false,
      mainStatWeight: 0,
      gradeThresholds: { s: 3, a: 2, b: 1, c: 0 },
    };
    const recommended = recommendBuildLoadout(
      account,
      mixedBuild,
      allocationOnlyProfile,
      context
    );
    const selectedCavern = Object.values(recommended.selected)
      .map(({ relic }) => relic)
      .filter(
        (relic) => relic.slot !== "planarSphere" && relic.slot !== "linkRope"
      );
    expect(
      selectedCavern.filter((relic) => relic.setId === firstSet)
    ).toHaveLength(2);
    expect(
      selectedCavern.filter((relic) => relic.setId === secondSet)
    ).toHaveLength(2);
  });

  it("keeps manager exports advisory, idempotent, and free of account identifiers", async () => {
    const { account, profile, build, context } = await setupBuild();
    const evaluations = evaluateAccountTriage(
      account,
      [build],
      [profile],
      DEFAULT_WORKSPACE.triageRules,
      context
    );
    expect(
      evaluations
        .filter(({ relic }) => relic.equippedCharacterKey)
        .every(({ result }) => result.decision === "keep")
    ).toBe(true);
    const first = await createManagerInstructionEnvelope(
      account,
      evaluations,
      HSR_REFERENCE_MANIFEST.source.revision,
      "ggstarrail-review-2026-09-02-001"
    );
    const second = await createManagerInstructionEnvelope(
      account,
      evaluations,
      HSR_REFERENCE_MANIFEST.source.revision,
      "24094626-9096-441c-abf0-96734124bfa9"
    );
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.instructions.length).toBeGreaterThan(0);
    expect(
      first.instructions.every(
        ({ before }) => before.lock === null && before.discard === null
      )
    ).toBe(true);
    expect(first.requestId).toBe("ggstarrail-review-2026-09-02-001");
    expect(first.idempotencyKey).toMatch(/^sha256:[a-f0-9]{64}$/);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain(account.profileId);
    expect(serialized).not.toContain("equippedCharacterKey");
    expect(serialized).not.toContain("localId");

    const actionability = summarizeManagerInstructionActionability(first);
    expect(actionability.previewOnlyCount).toBe(first.instructions.length);
    expect(actionability.reasonCounts["unknown-before"]).toBeGreaterThan(0);
    expect(actionability.reasonCounts.equipped).toBeGreaterThan(0);
  });

  it("keeps a locked discard instruction preview-only when locked-piece protection is disabled", async () => {
    const { account } = await setupBuild();
    const candidate = account.relics.find(
      (relic) => !relic.equippedCharacterKey && relic.discarded !== true
    );
    if (!candidate) throw new Error("Unequipped demo Relic missing");
    const lockedCandidate = { ...candidate, locked: true };
    const scannerAccount = AccountSnapshotSchema.parse({
      ...account,
      relics: account.relics.map((relic) =>
        relic.key === lockedCandidate.key ? lockedCandidate : relic
      ),
      source: { ...account.source, provider: "scanner-export" },
    });
    const result = triageRelic(
      {
        score: 0,
        locked: true,
        equipped: false,
        configuredBuildCount: 1,
        matchingBuildCount: 0,
      },
      { ...DEFAULT_WORKSPACE.triageRules, protectLocked: false }
    );
    expect(result.decision).toBe("salvage-review");

    const preview = await createManagerInstructionPreview(
      scannerAccount,
      [
        {
          relic: lockedCandidate,
          score: 0,
          grade: "D",
          matchingBuildIds: [],
          result,
        },
      ],
      HSR_REFERENCE_MANIFEST.source.revision,
      "ggstarrail-locked-discard-guard"
    );
    const repeated = await createManagerInstructionPreview(
      scannerAccount,
      [
        {
          relic: lockedCandidate,
          score: 0,
          grade: "D",
          matchingBuildIds: [],
          result,
        },
      ],
      HSR_REFERENCE_MANIFEST.source.revision,
      "ggstarrail-locked-discard-guard-repeat"
    );
    const publicEnvelope = await createManagerInstructionEnvelope(
      scannerAccount,
      [
        {
          relic: lockedCandidate,
          score: 0,
          grade: "D",
          matchingBuildIds: [],
          result,
        },
      ],
      HSR_REFERENCE_MANIFEST.source.revision,
      "ggstarrail-locked-discard-guard"
    );

    expect(preview.envelope.instructions).toHaveLength(0);
    expect(publicEnvelope).toEqual(preview.envelope);
    expect(preview.omittedInstructionIds).toEqual(["hsr-manager-0001-discard"]);
    expect(preview.envelope.idempotencyKey).toBe(
      repeated.envelope.idempotencyKey
    );
    expect(preview.actionability).toMatchObject({
      actionableCount: 0,
      previewOnlyCount: 1,
      reasonCounts: { locked: 1 },
      instructions: [
        {
          actionable: false,
          reasons: ["locked"],
        },
      ],
    });
    const serialized = serializeManagerInstructionEnvelope(preview.envelope);
    expect(JSON.parse(serialized).instructions).toEqual([]);
    expect(serialized).not.toContain('"discard": true');

    expect(() =>
      serializeManagerInstructionEnvelope({
        ...preview.envelope,
        instructions: [
          {
            id: "unsafe-locked-discard",
            matcher: {
              key: lockedCandidate.definitionId,
              gameId: Number(lockedCandidate.definitionId),
              setKey: lockedCandidate.setId,
              locationKey: null,
              rarity: lockedCandidate.rarity,
              slot: (
                {
                  head: "Head",
                  hands: "Hands",
                  body: "Body",
                  feet: "Feet",
                  planarSphere: "PlanarSphere",
                  linkRope: "LinkRope",
                } as const
              )[lockedCandidate.slot],
              level: lockedCandidate.level,
              mainStat: {
                key: lockedCandidate.mainStat.statId,
                value: lockedCandidate.mainStat.value,
              },
              substats: lockedCandidate.substats.map((substat) => ({
                key: substat.statId,
                value: substat.value,
              })),
            },
            before: { lock: true, discard: false },
            desired: { discard: true },
          },
        ],
      })
    ).toThrow(/unlocked in a separate reviewed run/i);
  });

  it("round-trips builds separately from account data", async () => {
    const { build, profile } = await setupBuild();
    const bundle = createBuildWorkspaceBundle({
      builds: [build],
      scoreProfiles: [profile],
      triageRules: DEFAULT_WORKSPACE.triageRules,
    });
    expect(bundle.schema).toBe("ggstarrail.build-workspace");
    expect(JSON.stringify(bundle)).not.toContain("profile:local");
  });

  it("rejects duplicate workspace ids, orphan profiles, and out-of-range triage rules", async () => {
    const { build, profile } = await setupBuild();
    expect(() =>
      createBuildWorkspaceBundle({
        builds: [build, { ...build, id: profile.id }],
        scoreProfiles: [profile],
        triageRules: DEFAULT_WORKSPACE.triageRules,
      })
    ).toThrow();
    expect(() =>
      createBuildWorkspaceBundle({
        builds: [{ ...build, scoreProfileId: "score:missing" }],
        scoreProfiles: [profile],
        triageRules: DEFAULT_WORKSPACE.triageRules,
      })
    ).toThrow(/missing Score Profile/);
    expect(() =>
      createBuildWorkspaceBundle({
        builds: [build],
        scoreProfiles: [profile],
        triageRules: {
          ...DEFAULT_WORKSPACE.triageRules,
          keepScoreAtLeast: 101,
        },
      })
    ).toThrow();

    expect(
      PersistedWorkspaceSchema.safeParse({
        ...DEFAULT_WORKSPACE,
        builds: [build],
        scoreProfiles: [{ ...profile }, { ...profile }],
      }).success
    ).toBe(false);
  });

  it("rejects duplicate, fifth, and main-colliding substats", () => {
    const base = makeRelic();
    expect(
      RelicSchema.safeParse({
        ...base,
        substats: [base.substats[0], base.substats[0]],
      }).success
    ).toBe(false);
    expect(
      RelicSchema.safeParse({
        ...base,
        substats: [
          { statId: "one", value: 1 },
          { statId: "two", value: 1 },
          { statId: "three", value: 1 },
          { statId: "four", value: 1 },
          { statId: "five", value: 1 },
        ],
      }).success
    ).toBe(false);
    expect(
      RelicSchema.safeParse({
        ...base,
        substats: [{ ...base.mainStat }],
      }).success
    ).toBe(false);
    expect(AccountSnapshotSchema.safeParse({}).success).toBe(false);
  });
});
