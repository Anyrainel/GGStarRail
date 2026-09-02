import { describe, expect, it } from "vitest";
import type { Relic } from "@/domain/account/schemas";
import type { ScoreProfile } from "@/domain/build/schemas";
import { scoreRelic } from "@/domain/build/scoring";
import {
  createRelicScoringContext,
  loadBuildReferences,
} from "@/lib/buildReferences";
import {
  generatedRelicMainStatDisplayValues,
  validateRelicMainStatDisplayValue,
} from "@/providers/relicMainStat";

const mainStatOnlyProfile: ScoreProfile = {
  id: "score:main-stat-progression",
  name: "Main-stat progression",
  statWeights: {},
  includeMainStat: true,
  mainStatWeight: 1,
  gradeThresholds: { s: 80, a: 60, b: 40, c: 20 },
};

const levels = [0, 6, 15] as const;
const expectedScores = [16, 49.6, 100];

const scenarios = [
  {
    label: "flat HP",
    definitionId: "61011",
    propertyId: "HPDelta",
    slot: "head",
    expectedUiRounded: [112.9, 350, 705.6],
  },
  {
    label: "ratio ATK",
    definitionId: "61013",
    propertyId: "AttackAddedRatio",
    slot: "body",
    expectedUiRounded: [6.9, 21.4, 43.2],
  },
] as const satisfies readonly {
  label: string;
  definitionId: string;
  propertyId: string;
  slot: Relic["slot"];
  expectedUiRounded: readonly number[];
}[];

describe("generated Relic main-stat scoring", () => {
  it.each(
    scenarios
  )("scores $label by generated level progress, independent of its observed value", async (scenario) => {
    const references = await loadBuildReferences();
    const context = createRelicScoringContext(references);
    const piece = references.relicPieces.byId.get(scenario.definitionId);
    if (!piece) throw new Error(`Missing Relic piece ${scenario.definitionId}`);

    const maxDisplayValue = generatedRelicMainStatDisplayValues(
      piece,
      scenario.propertyId,
      piece.max_level,
      references.properties.properties,
      references.progression.relic_main_affixes
    ).uiRounded;
    const uiRoundedValues: number[] = [];
    const uiRoundedScores: number[] = [];
    const copiedValueScores: number[] = [];
    const corruptValueScores: number[] = [];

    for (const level of levels) {
      const generated = generatedRelicMainStatDisplayValues(
        piece,
        scenario.propertyId,
        level,
        references.properties.properties,
        references.progression.relic_main_affixes
      );
      expect(() =>
        validateRelicMainStatDisplayValue(
          piece,
          { statId: scenario.propertyId, value: generated.uiRounded },
          level,
          references.properties.properties,
          references.progression.relic_main_affixes
        )
      ).not.toThrow();

      const scoreObservedValue = (value: number) => {
        const relic: Relic = {
          key: `${scenario.propertyId}:${level}`,
          definitionId: piece.id,
          setId: piece.set_id,
          slot: scenario.slot,
          rarity: piece.rarity,
          level,
          mainStat: { statId: scenario.propertyId, value },
          substats: [],
          locked: false,
          discarded: false,
        };
        return scoreRelic(relic, mainStatOnlyProfile, context).mainStatScore;
      };

      uiRoundedValues.push(generated.uiRounded);
      uiRoundedScores.push(scoreObservedValue(generated.uiRounded));
      copiedValueScores.push(scoreObservedValue(maxDisplayValue));
      corruptValueScores.push(scoreObservedValue(999_999));
    }

    expect(uiRoundedValues).toEqual(scenario.expectedUiRounded);
    expect(uiRoundedScores).toEqual(expectedScores);
    expect(copiedValueScores).toEqual(expectedScores);
    expect(corruptValueScores).toEqual(expectedScores);
    expect(uiRoundedScores[0]).toBeLessThan(uiRoundedScores[1] ?? 0);
    expect(uiRoundedScores[1]).toBeLessThan(uiRoundedScores[2] ?? 0);
  });
});
