import { describe, expect, it } from "vitest";
import {
  createBackupEnvelope,
  parseBackup,
  serializeBackup,
} from "@/lib/backup";
import { migrateWorkspace } from "@/stores/migration/workspace";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { makeAccountSnapshot } from "./fixtures";

describe("independent persistence and backup identity", () => {
  it("round-trips only the GGStarRail envelope", () => {
    const workspace = {
      ...structuredClone(DEFAULT_WORKSPACE),
      account: makeAccountSnapshot(),
    };
    const serialized = serializeBackup(workspace);
    const parsed = parseBackup(serialized);
    expect(parsed.product).toBe("GGStarRail");
    expect(parsed.kind).toBe("ggstarrail.backup");
    expect(parsed.payload.account?.characters).toHaveLength(1);
    expect(serialized).not.toContain("GenshinTools");
    expect(serialized).not.toContain("GGArtifact");
  });

  it("rejects cross-product and sensitive-shaped payloads", () => {
    const valid = createBackupEnvelope(DEFAULT_WORKSPACE);
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, product: "GenshinTools" }))
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({ ...valid, payload: { ...valid.payload, ltoken: "x" } })
      )
    ).toThrow(/Sensitive field/);
  });

  it("keeps the first store migration boundary closed to unknown versions", () => {
    expect(migrateWorkspace({ account: "legacy" }, 0)).toEqual(
      DEFAULT_WORKSPACE
    );
    expect(migrateWorkspace({ malformed: true }, 1)).toEqual(DEFAULT_WORKSPACE);
  });

  it("migrates a realistic v1 backup through the public backup parser", () => {
    const currentAccount = makeAccountSnapshot();
    const { coverage: _coverage, ...sourceV1 } = currentAccount.source;
    const accountV1 = {
      ...currentAccount,
      schemaVersion: 1,
      relics: currentAccount.relics.map(
        ({ discarded: _discarded, ...relic }) => relic
      ),
      source: sourceV1,
    };
    const serialized = JSON.stringify({
      product: "GGStarRail",
      kind: "ggstarrail.backup",
      schemaVersion: 1,
      createdAt: "2026-08-30T00:00:00.000Z",
      payload: {
        schemaVersion: 1,
        account: accountV1,
        builds: [
          {
            id: "build:v1",
            name: "Legacy build",
            characterDefinitionId: "character:trailblazer",
            scoreProfileId: "score:v1",
            preferredMainStats: {
              head: ["hp"],
              hands: ["attack"],
              body: ["crit-rate"],
              feet: ["speed"],
              planarSphere: ["ice-damage"],
              linkRope: ["energy-regeneration"],
            },
            requiredSetIds: ["relic-set:1", "planar-set:1"],
            computedFilterIds: [],
          },
        ],
        scoreProfiles: [
          {
            id: "score:v1",
            name: "Legacy score",
            statWeights: { "crit-rate": 2, "crit-dmg": -1 },
            includeMainStat: false,
          },
        ],
        computedFilters: [],
        triageRules: {
          keepScoreAtLeast: 20,
          reviewScoreAtLeast: 10,
          protectLocked: true,
          protectEquipped: true,
        },
      },
    });

    const parsed = parseBackup(serialized);
    expect(parsed.payload.schemaVersion).toBe(2);
    expect(parsed.payload.account?.schemaVersion).toBe(2);
    expect(parsed.payload.account?.relics[0]?.discarded).toBeNull();
    expect(parsed.payload.account?.source.coverage.relics).toBe("unknown");
    expect(parsed.payload.builds[0]?.cavern).toEqual({
      mode: "four-piece",
      setId: "relic-set:1",
    });
    expect(parsed.payload.scoreProfiles[0]?.statWeights).toEqual({
      "crit-rate": 1,
      "crit-dmg": 0,
    });
    expect(parsed.payload.scoreProfiles[0]?.gradeThresholds).toEqual({
      s: 50,
      a: 40,
      b: 30,
      c: 20,
    });
  });

  it("drops incomplete v1 builds and preserves an explicit three-set split", () => {
    const baseBuild = {
      name: "Legacy build",
      characterDefinitionId: "character:legacy",
      scoreProfileId: "score:legacy",
      preferredMainStats: {
        head: ["HPDelta"],
        hands: ["AttackDelta"],
        body: ["CriticalChanceBase"],
        feet: ["SpeedDelta"],
        planarSphere: ["IceAddedRatio"],
        linkRope: ["SPRatioBase"],
      },
      computedFilterIds: [],
    };
    const migrated = migrateWorkspace(
      {
        schemaVersion: 1,
        account: null,
        builds: [
          { ...baseBuild, id: "build:empty", requiredSetIds: [] },
          {
            ...baseBuild,
            id: "build:one-set",
            requiredSetIds: ["set:cavern-a"],
          },
          {
            ...baseBuild,
            id: "build:three-sets",
            requiredSetIds: ["set:cavern-a", "set:cavern-b", "set:planar-a"],
          },
          {
            ...baseBuild,
            id: "build:three-sets",
            requiredSetIds: ["set:cavern-a", "set:planar-a"],
          },
          {
            ...baseBuild,
            id: "score:legacy",
            requiredSetIds: ["set:cavern-a", "set:planar-a"],
          },
        ],
        scoreProfiles: [
          {
            id: "score:legacy",
            name: "Legacy score",
            statWeights: { CriticalChanceBase: 1 },
            includeMainStat: true,
          },
          {
            id: "score:legacy",
            name: "Duplicate legacy score",
            statWeights: { CriticalDamageBase: 1 },
            includeMainStat: false,
          },
        ],
        computedFilters: [],
        triageRules: {
          keepScoreAtLeast: 40,
          reviewScoreAtLeast: 20,
          protectLocked: true,
          protectEquipped: true,
        },
      },
      1
    );

    expect(migrated.builds).toHaveLength(1);
    expect(migrated.scoreProfiles).toHaveLength(1);
    expect(migrated.builds[0]?.id).toBe("build:three-sets");
    expect(migrated.builds[0]?.cavern).toEqual({
      mode: "two-plus-two",
      setIds: ["set:cavern-a", "set:cavern-b"],
    });
    expect(migrated.builds[0]?.planarSetId).toBe("set:planar-a");
    expect(JSON.stringify(migrated)).not.toContain("unconfigured:");
    expect("computedFilters" in migrated).toBe(false);
  });

  it("normalizes duplicate and dangling v1 account equipment", () => {
    const account = makeAccountSnapshot();
    const { coverage: _coverage, ...source } = account.source;
    const legacyAccount = {
      ...account,
      schemaVersion: 1 as const,
      characters: [
        account.characters[0]!,
        { ...account.characters[0]!, relicKeys: ["relic:missing"] },
      ],
      lightCones: [
        { ...account.lightCones[0]!, locked: true },
        { ...account.lightCones[0]!, locked: false },
        {
          ...account.lightCones[0]!,
          key: "light-cone:dangling",
          locked: false,
          equippedCharacterKey: "character:missing",
        },
      ],
      relics: [
        {
          ...account.relics[0]!,
          locked: true,
          discarded: undefined,
        },
        {
          ...account.relics[0]!,
          locked: false,
          discarded: undefined,
        },
        {
          ...account.relics[0]!,
          key: "relic:duplicate-slot",
          locked: false,
          discarded: undefined,
        },
        {
          ...account.relics[0]!,
          key: "relic:dangling",
          locked: false,
          discarded: undefined,
          equippedCharacterKey: "character:missing",
        },
      ].map(({ discarded: _discarded, ...relic }) => relic),
      source,
    };

    const migrated = migrateWorkspace(
      {
        schemaVersion: 1,
        account: legacyAccount,
        builds: [],
        scoreProfiles: [],
        computedFilters: [
          {
            id: "computed:legacy",
            name: "Derived legacy cache",
            mode: "all",
            clauses: [{ field: "level", operation: "gte", value: 0 }],
          },
        ],
        triageRules: {
          keepScoreAtLeast: 40,
          reviewScoreAtLeast: 20,
          protectLocked: true,
          protectEquipped: true,
        },
      },
      1
    );

    expect(migrated.account?.characters).toHaveLength(1);
    expect(migrated.account?.lightCones).toHaveLength(2);
    expect(migrated.account?.relics).toHaveLength(3);
    expect(
      migrated.account?.lightCones.find(
        ({ key }) => key === "light-cone:dangling"
      )?.equippedCharacterKey
    ).toBeUndefined();
    expect(
      migrated.account?.relics.find(({ key }) => key === "relic:duplicate-slot")
        ?.equippedCharacterKey
    ).toBeUndefined();
    expect(migrated.account?.characters[0]?.relicKeys).toEqual(["relic:1"]);
    expect("computedFilters" in migrated).toBe(false);
  });
});
