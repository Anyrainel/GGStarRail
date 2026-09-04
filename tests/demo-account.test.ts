import { describe, expect, it } from "vitest";
import type { Relic } from "@/domain/account/schemas";
import type { ScoreProfile } from "@/domain/build/schemas";
import { scoreRelic } from "@/domain/build/scoring";
import {
  createRelicScoringContext,
  loadBuildReferences,
} from "@/lib/buildReferences";
import { createDemoAccount } from "@/lib/demoAccount";
import type {
  PropertyDefinition,
  RelicPieceDefinition,
  SubAffixDefinition,
} from "@/providers/gilore/types";
import { parseVersionedScannerExport } from "@/providers/scanner/schema";

function displayValue(property: PropertyDefinition, sourceValue: number) {
  const value =
    property.value_kind === "ratio" ? sourceValue * 100 : sourceValue;
  return Number(value.toFixed(3));
}

function inferredMaximumRollCount(
  relic: Relic,
  piece: RelicPieceDefinition,
  propertyById: ReadonlyMap<string, PropertyDefinition>,
  subAffixes: readonly SubAffixDefinition[]
): number {
  return relic.substats.reduce((total, stat) => {
    const property = propertyById.get(stat.statId);
    const affix = subAffixes.find(
      (candidate) =>
        candidate.group_id === piece.sub_affix_group &&
        candidate.property_id === stat.statId
    );
    expect(property, `${relic.key}/${stat.statId} property`).toBeDefined();
    expect(affix, `${relic.key}/${stat.statId} affix`).toBeDefined();
    const maximumRoll = affix?.roll_values.at(-1);
    expect(
      maximumRoll,
      `${relic.key}/${stat.statId} maximum roll`
    ).toBeDefined();
    const count = Array.from({ length: 9 }, (_, index) => index + 1).find(
      (candidate) =>
        property !== undefined &&
        maximumRoll !== undefined &&
        Math.abs(
          displayValue(property, maximumRoll * candidate) - stat.value
        ) <= 1e-6
    );
    expect(count, `${relic.key}/${stat.statId} legal roll count`).toBeDefined();
    return total + (count ?? 0);
  }, 0);
}

describe("demo Relic progression", () => {
  it("uses generated main-affix values at +0, +6, and +15", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(new Date("2026-09-02T12:00:00.000Z")),
      loadBuildReferences(),
    ]);
    const spares = account.relics.filter((relic) =>
      relic.key.startsWith("demo-relic:spare:")
    );
    expect(account.achievementCompletion).toBeUndefined();

    expect(new Set(spares.map((relic) => relic.level))).toEqual(
      new Set([0, 6, 15])
    );
    for (const relic of spares) {
      const piece = references.relicPieces.byId.get(relic.definitionId);
      const property = references.properties.propertyById.get(
        relic.mainStat.statId
      );
      const affix = references.progression.relic_main_affixes.find(
        (candidate) =>
          candidate.group_id === piece?.main_affix_group &&
          candidate.property_id === relic.mainStat.statId
      );
      const generated = affix?.level_values[relic.level];
      expect(piece, `${relic.key} piece`).toBeDefined();
      expect(property, `${relic.key} property`).toBeDefined();
      expect(generated, `${relic.key} level value`).toBeDefined();
      if (property && generated !== undefined) {
        const expected =
          property.value_kind === "ratio" ? generated * 100 : generated;
        expect(relic.mainStat.value).toBeCloseTo(expected, 8);
      }
    }

    await expect(
      parseVersionedScannerExport({
        format: "ggstarrail-scanner-export",
        schemaVersion: 1,
        sourceApp: { name: "GGStarRail demo", version: "1" },
        exportedAt: "2026-09-02T12:00:00.000Z",
        account,
      })
    ).resolves.toMatchObject({ account: { profileId: "demo-account:v3" } });

    const invalidNativeAccount = structuredClone(account);
    const levelSix = invalidNativeAccount.relics.find(
      (relic) => relic.key.startsWith("demo-relic:spare:") && relic.level === 6
    );
    if (!levelSix) throw new Error("Missing demo Relic at +6");
    levelSix.mainStat.value += 1;
    await expect(
      parseVersionedScannerExport({
        format: "ggstarrail-scanner-export",
        schemaVersion: 1,
        sourceApp: { name: "GGStarRail demo", version: "1" },
        exportedAt: "2026-09-02T12:00:00.000Z",
        account: invalidNativeAccount,
      })
    ).rejects.toThrow(/does not match generated value.*at level 6/);
  });

  it("builds legal initial and upgrade roll histories with increasing score", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(new Date("2026-09-02T12:00:00.000Z")),
      loadBuildReferences(),
    ]);
    const spares = account.relics.filter((relic) =>
      relic.key.startsWith("demo-relic:spare:")
    );
    for (const relic of spares) {
      const piece = references.relicPieces.byId.get(relic.definitionId);
      expect(piece, `${relic.key} piece`).toBeDefined();
      if (!piece) continue;
      const rollCount = inferredMaximumRollCount(
        relic,
        piece,
        references.properties.propertyById,
        references.progression.relic_sub_affixes
      );
      const upgradeRolls = Math.floor(relic.level / 3);
      const minimumInitialLines = Math.max(1, Math.min(4, relic.rarity - 2));
      const maximumInitialLines = Math.max(1, Math.min(4, relic.rarity - 1));
      expect([
        minimumInitialLines + upgradeRolls,
        maximumInitialLines + upgradeRolls,
      ]).toContain(rollCount);
      expect(relic.substats).toHaveLength(Math.min(4, rollCount));
    }

    const representatives = [0, 6, 15].map((level) => {
      const relic = spares.find((candidate) => candidate.level === level);
      if (!relic) throw new Error(`Missing demo Relic at +${level}`);
      return relic;
    });
    const statWeights = Object.fromEntries(
      representatives.flatMap((relic) =>
        relic.substats.map((stat) => [stat.statId, 1] as const)
      )
    );
    const profile: ScoreProfile = {
      id: "score:demo-progression",
      name: "Demo progression",
      statWeights,
      includeMainStat: false,
      mainStatWeight: 0,
      gradeThresholds: { s: 80, a: 60, b: 40, c: 20 },
    };
    const context = createRelicScoringContext(references);
    const weightedRolls = representatives.map(
      (relic) => scoreRelic(relic, profile, context).weightedRolls
    );
    expect(weightedRolls[0]).toBeLessThan(weightedRolls[1] ?? 0);
    expect(weightedRolls[1]).toBeLessThan(weightedRolls[2] ?? 0);
  });
});
