import { beforeEach, describe, expect, it } from "vitest";
import { setBetaEnabled } from "@/data/betaState";
import {
  getLocalizedValue,
  HSR_REFERENCE_MANIFEST,
  isCharacterDefinitionV1_1,
  isProgressionTablesV1_1,
  isPropertyDefinitionV1_1,
  loadAchievementCategories,
  loadAchievementIds,
  loadAchievements,
  loadCharacters,
  loadLightCones,
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/gilore/catalog";
import type { CharacterDefinitionV1_1 } from "@/providers/gilore/types";

describe("lazy GIlore catalog provider", () => {
  // Coverage of the complete normalized snapshot, including opt-in records.
  // The released-only transport and network gate are tested separately.
  beforeEach(() => setBetaEnabled(true));
  it("loads complete typed catalogs with stable bilingual identities", async () => {
    const [
      achievementCategories,
      achievements,
      achievementIds,
      characters,
      lightCones,
      relicSets,
      relicPieces,
      propertyTables,
    ] = await Promise.all([
      loadAchievementCategories(),
      loadAchievements(),
      loadAchievementIds(),
      loadCharacters(),
      loadLightCones(),
      loadRelicSets(),
      loadRelicPieces(),
      loadPropertyTables(),
    ]);

    expect(HSR_REFERENCE_MANIFEST.source.revision).toBe(
      "8cdb905dc2f8e6fffa9be4eb07af3e34435d6091"
    );
    expect(HSR_REFERENCE_MANIFEST.schema_version).toBe("1.2.0");
    expect(achievementCategories.values).toHaveLength(9);
    expect(achievements.values).toHaveLength(1921);
    expect(achievementIds.size).toBe(1921);
    expect(characters.values).toHaveLength(93);
    expect(lightCones.values).toHaveLength(169);
    expect(relicSets.values).toHaveLength(60);
    expect(relicPieces.values).toHaveLength(742);
    expect(propertyTables.properties).toHaveLength(56);
    expect(propertyTables.paths).toHaveLength(9);
    expect(propertyTables.combatTypes).toHaveLength(7);
    expect(propertyTables.relicSlots).toHaveLength(6);
    expect(achievementCategories.schemaVersion).toBe("1.2.0");
    expect(achievements.schemaVersion).toBe("1.2.0");
    expect(characters.schemaVersion).toBe("1.2.0");
    expect(lightCones.schemaVersion).toBe("1.2.0");
    expect(propertyTables.schemaVersion).toBe("1.2.0");

    const trailblazerCategory = achievementCategories.byId.get(1);
    expect(getLocalizedValue(trailblazerCategory?.name, "en")).toBe(
      "I, Trailblazer"
    );
    const everBurningAmber = achievements.byId.get(4_010_101);
    expect(getLocalizedValue(everBurningAmber?.name, "en")).toBe(
      "Ever-Burning Amber"
    );
    expect(everBurningAmber).toMatchObject({
      category_id: 1,
      chain_ids: [4_010_101],
      chain_index: 0,
      previous_id: null,
      next_ids: [],
      release_version: null,
      reward: { item_id: 1, count: 20 },
    });
    expect(achievementIds.has(4_010_101)).toBe(true);
    const hidden = achievements.values.find(
      (achievement) => achievement.visibility === "hidden_description"
    );
    expect(hidden?.hidden_description).not.toBeNull();
    expect(
      achievements.values.some(
        (achievement) => achievement.description_parameters.length > 0
      )
    ).toBe(true);

    const march = characters.byId.get("1001");
    expect(getLocalizedValue(march?.name, "en")).toBe("March 7th");
    expect(getLocalizedValue(march?.name, "zh-CN")).toBe("三月七");
    expect(march?.path_id).toBe("Knight");
    expect(propertyTables.pathById.get("Knight")).toBeDefined();
    expect(propertyTables.combatTypeById.get("Ice")).toBeDefined();
    const stanceBreak = propertyTables.propertyById.get(
      "StanceBreakAddedRatio"
    );
    expect(stanceBreak?.icon_path).toBe("0");
    expect(stanceBreak && isPropertyDefinitionV1_1(stanceBreak)).toBe(true);
    if (!stanceBreak || !isPropertyDefinitionV1_1(stanceBreak)) {
      throw new Error("expected schema 1.1 property definition");
    }
    expect(stanceBreak.usable_icon_path).toBeNull();

    const expandedCharacters: CharacterDefinitionV1_1[] = [];
    for (const character of characters.values) {
      if (!isCharacterDefinitionV1_1(character)) {
        throw new Error("expected schema 1.1 character definitions");
      }
      expandedCharacters.push(character);
    }

    const skills = expandedCharacters.flatMap((character) => character.skills);
    const ranks = expandedCharacters.flatMap((character) => character.ranks);
    const traces = expandedCharacters.flatMap((character) => character.traces);
    const servants = expandedCharacters.flatMap(
      (character) => character.servants
    );
    const enhancements = expandedCharacters.flatMap(
      (character) => character.enhancements
    );
    expect(skills).toHaveLength(611);
    expect(ranks).toHaveLength(558);
    expect(traces).toHaveLength(1_699);
    expect(traces.flatMap((trace) => trace.levels)).toHaveLength(4_818);
    expect(
      skills.filter(
        (skill) => skill.display_description_source === "description"
      )
    ).toHaveLength(92);
    expect(servants).toHaveLength(8);
    expect(new Set(servants.map((servant) => servant.id)).size).toBe(7);
    expect(
      new Set(
        servants.flatMap((servant) => servant.skills.map((skill) => skill.id))
      ).size
    ).toBe(48);
    expect(enhancements).toHaveLength(10);
    expect(enhancements.flatMap((entry) => entry.skills)).toHaveLength(64);
    expect(enhancements.flatMap((entry) => entry.ranks)).toHaveLength(60);
    expect(enhancements.flatMap((entry) => entry.traces)).toHaveLength(180);
    expect(
      enhancements.flatMap((entry) =>
        entry.traces.flatMap((trace) => trace.levels)
      )
    ).toHaveLength(500);

    const weltEnhancement = expandedCharacters.find(
      (character) => character.id === "1004"
    )?.enhancements[0];
    expect(weltEnhancement).toMatchObject({
      activity_id: 50_100,
      enhanced_id: 1,
      season_id: 3,
    });
    const garmentmaker = servants.find((servant) => servant.id === "11402");
    expect(getLocalizedValue(garmentmaker?.name, "en")).toBe("Garmentmaker");
    expect(garmentmaker?.skills[0].id).toBe("1140201");
    const servantDescriptionFallback = servants
      .flatMap((servant) => servant.skills)
      .find((skill) => skill.id === "1140710");
    expect(servantDescriptionFallback?.description).not.toBeNull();
    expect(
      servantDescriptionFallback?.description.en.provenance.source_id
    ).toBe("turn_based_game_data");
    expect(
      servantDescriptionFallback?.description.en.provenance.source_key
    ).toBe(
      servantDescriptionFallback?.simple_description?.en.provenance.source_key
    );

    expect(
      lightCones.values.flatMap(
        (lightCone) => lightCone.effect.superimpositions
      )
    ).toHaveLength(845);
    expect(
      lightCones.values.every(
        (lightCone) =>
          lightCone.effect.superimpositions.length ===
          lightCone.max_superimposition
      )
    ).toBe(true);
  });

  it("exposes complete progression lazily", async () => {
    const progression = await loadProgression();
    if (!isProgressionTablesV1_1(progression)) {
      throw new Error("expected schema 1.1 progression tables");
    }
    expect(progression.relic_main_affixes).toHaveLength(117);
    expect(progression.relic_sub_affixes).toHaveLength(48);
    expect(progression.relic_scoring.main_affix_base_values).toHaveLength(20);
    expect(progression.relic_scoring.sub_affix_base_values).toHaveLength(12);
    expect(progression.relic_scoring.main_affix_character_weights).toHaveLength(
      97
    );
    expect(progression.relic_scoring.sub_affix_character_weights).toHaveLength(
      97
    );
    expect(progression.items).toHaveLength(238);
    expect(
      progression.items.filter((item) => item.source_table === "ItemConfig")
    ).toHaveLength(150);
    expect(
      progression.items.filter(
        (item) => item.source_table === "ItemConfigAvatarRank"
      )
    ).toHaveLength(88);
    expect(
      progression.items.filter(
        (item) =>
          item.character_experience !== null ||
          item.light_cone_experience !== null
      )
    ).toHaveLength(6);
    expect(getLocalizedValue(progression.items[0].name, "en")).toBe("Credit");
  });
});
