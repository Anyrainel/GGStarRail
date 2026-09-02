import { beforeAll, describe, expect, it } from "vitest";
import type { RelicSlot } from "@/domain/account/schemas";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { generateResourceSuggestions } from "@/domain/resources/recommendations";
import { DEFAULT_RESOURCE_SETTINGS } from "@/domain/resources/schemas";
import type {
  ResourceRecommendationInput,
  ResourceRelicDefinition,
} from "@/domain/resources/types";
import {
  type BuildReferences,
  createRelicScoringContext,
  loadBuildReferences,
} from "@/lib/buildReferences";
import { createDemoAccount } from "@/lib/demoAccount";
import { accountRelicSlot } from "@/providers/accountNormalization";

type Setup = Omit<ResourceRecommendationInput, "settings"> & {
  references: BuildReferences;
};

let setup: Setup;

beforeAll(async () => {
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
    "Resource score",
    "score:resources"
  );
  const build = createCharacterBuild(
    character,
    ownedCharacter.key,
    account.relics,
    references.relicSets.values,
    references.properties,
    references.progression,
    profile.id,
    "Resource build",
    "build:resources"
  );
  const relicDefinitions: ResourceRelicDefinition[] =
    references.relicPieces.values.map((definition) => ({
      id: definition.id,
      setId: definition.set_id,
      slot: accountRelicSlot(definition.slot),
      rarity: definition.rarity,
      maxLevel: definition.max_level,
    }));
  setup = {
    account,
    builds: [build],
    scoreProfiles: [profile],
    scoringContext: createRelicScoringContext(references),
    relicDefinitions,
    references,
  };
});

describe("HSR resource suggestions", () => {
  it("covers leveling, synthesis, and Variable Dice across all six slots", () => {
    const suggestions = generateResourceSuggestions({
      ...setup,
      settings: {
        ...DEFAULT_RESOURCE_SETTINGS,
        minimumScoreGap: { "level-up": 0, synthesize: 0, reroll: 0 },
      },
    });

    expect(new Set(suggestions.map(({ kind }) => kind))).toEqual(
      new Set(["level-up", "synthesize", "reroll"])
    );
    expect(new Set(suggestions.map(({ category }) => category))).toEqual(
      new Set(["cavern", "planar"])
    );
    expect(new Set(suggestions.map(({ slot }) => slot))).toEqual(
      new Set<RelicSlot>([
        "head",
        "hands",
        "body",
        "feet",
        "planarSphere",
        "linkRope",
      ])
    );

    const relicByKey = new Map(
      setup.account.relics.map((relic) => [relic.key, relic])
    );
    for (const suggestion of suggestions) {
      if (suggestion.kind === "synthesize") {
        expect(suggestion.relicRemains).toBe(100);
        expect(suggestion.selfModelingResin).toBe(
          suggestion.slot === "head" || suggestion.slot === "hands" ? 0 : 1
        );
      } else {
        const relic = relicByKey.get(suggestion.relicKey);
        expect(relic).toBeDefined();
        expect(relic?.rarity).toBe(5);
        if (suggestion.kind === "level-up") {
          expect(relic?.level).toBeLessThan(suggestion.targetLevel);
          expect(suggestion.opportunityScore).toBeGreaterThan(0);
          expect(suggestion.optimisticScore).toBeGreaterThanOrEqual(
            suggestion.currentScore ?? 0
          );
        } else {
          expect(relic?.level).toBe(suggestion.targetLevel);
          expect(suggestion.variableDice).toBe(1);
          expect(suggestion.optimisticScore).toBeGreaterThanOrEqual(
            suggestion.currentScore ?? 0
          );
        }
      }
    }
  });

  it("keeps a two-plus-two Cavern target at exactly two slots per set", () => {
    const cavernSetIds = [
      ...new Set(
        setup.account.relics
          .filter(
            (relic) =>
              relic.slot !== "planarSphere" && relic.slot !== "linkRope"
          )
          .map(({ setId }) => setId)
      ),
    ];
    const firstSetId = cavernSetIds[0];
    const secondSetId = cavernSetIds[1];
    if (!firstSetId || !secondSetId) {
      throw new Error("Demo account needs two Cavern sets");
    }
    const build = setup.builds[0];
    if (!build) throw new Error("Resource build missing");
    const suggestions = generateResourceSuggestions({
      ...setup,
      builds: [
        {
          ...build,
          cavern: {
            mode: "two-plus-two",
            setIds: [firstSetId, secondSetId],
          },
        },
      ],
      settings: {
        ...DEFAULT_RESOURCE_SETTINGS,
        enabledActions: {
          "level-up": false,
          synthesize: true,
          reroll: false,
        },
        minimumScoreGap: { "level-up": 0, synthesize: 0, reroll: 0 },
      },
    }).filter(
      (suggestion) =>
        suggestion.kind === "synthesize" && suggestion.category === "cavern"
    );
    const counts = new Map<string, number>();
    for (const suggestion of suggestions) {
      counts.set(suggestion.setId, (counts.get(suggestion.setId) ?? 0) + 1);
    }

    expect(suggestions).toHaveLength(4);
    expect(counts.get(firstSetId)).toBe(2);
    expect(counts.get(secondSetId)).toBe(2);
  });

  it("honors persisted action switches and score-gap thresholds deterministically", () => {
    const input: ResourceRecommendationInput = {
      ...setup,
      settings: {
        ...DEFAULT_RESOURCE_SETTINGS,
        enabledActions: {
          "level-up": false,
          synthesize: false,
          reroll: false,
        },
        minimumScoreGap: { "level-up": 0, synthesize: 50, reroll: 0 },
      },
    };

    expect(generateResourceSuggestions(input)).toEqual([]);
    const enabled = {
      ...input,
      settings: {
        ...input.settings,
        enabledActions: { ...input.settings.enabledActions, synthesize: true },
      },
    };
    expect(generateResourceSuggestions(enabled)).toEqual(
      generateResourceSuggestions(enabled)
    );
    expect(
      generateResourceSuggestions(enabled).every(
        (suggestion) =>
          suggestion.kind === "synthesize" && suggestion.opportunityScore >= 50
      )
    ).toBe(true);
  });
});
