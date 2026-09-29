import { beforeEach, describe, expect, it } from "vitest";
import { setBetaEnabled } from "@/data/betaState";
import {
  getLocalizedValue,
  HSR_REFERENCE_MANIFEST,
  HSR_REFERENCE_REVISION,
  loadAchievementIds,
  loadCharacters,
  loadLightCones,
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
  loadRelicSets,
} from "@/providers/reference/catalog";
import { loadCurrencyWarCatalog } from "@/providers/reference/currencyWar";

function payloadKeys(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(payloadKeys);
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...payloadKeys(child),
  ]);
}

describe("lazy reference producer catalog provider", () => {
  // Coverage of the complete normalized snapshot, including opt-in records.
  // The released-only transport and network gate are tested separately.
  beforeEach(() => setBetaEnabled(true));
  it("reconstructs all Currency War collections from independent bilingual members", async () => {
    const catalog = await loadCurrencyWarCatalog();
    expect(catalog.equipment).toHaveLength(165);
    expect(catalog.environments).toHaveLength(84);
    expect(catalog.strategies).toHaveLength(334);
    expect(catalog.bonds).toHaveLength(33);
    for (const collection of [
      catalog.equipment,
      catalog.environments,
      catalog.strategies,
      catalog.bonds,
    ]) {
      expect(new Set(collection.map((entry) => entry.id)).size).toBe(
        collection.length
      );
      for (const entry of collection) {
        expect(entry.name.en.value).not.toBe("");
        expect(entry.name["zh-CN"].value).not.toBe("");
        expect(Object.keys(entry.name.en)).toEqual(["value"]);
        expect(Object.keys(entry.name["zh-CN"])).toEqual(["value"]);
      }
    }
  });
  it("loads complete typed catalogs with stable bilingual identities", async () => {
    const [
      achievementIds,
      characters,
      lightCones,
      relicSets,
      relicPieces,
      propertyTables,
    ] = await Promise.all([
      loadAchievementIds(),
      loadCharacters(),
      loadLightCones(),
      loadRelicSets(),
      loadRelicPieces(),
      loadPropertyTables(),
    ]);

    expect(HSR_REFERENCE_REVISION).toBe(
      "6b2bc17ebf461e497ba0dd0ffd44875f1866762b"
    );
    expect(HSR_REFERENCE_MANIFEST.schema_version).toBe("2.0.0");
    expect(achievementIds.size).toBe(1950);
    expect(characters.values).toHaveLength(98);
    expect(lightCones.values).toHaveLength(170);
    expect(relicSets.values).toHaveLength(62);
    expect(relicPieces.values).toHaveLength(774);
    expect(propertyTables.properties).toHaveLength(56);
    expect(propertyTables.paths).toHaveLength(9);
    expect(propertyTables.combatTypes).toHaveLength(7);
    expect(propertyTables.relicSlots).toHaveLength(6);
    expect(characters.schemaVersion).toBe("2.0.0");
    expect(lightCones.schemaVersion).toBe("2.0.0");
    expect(propertyTables.schemaVersion).toBe("2.0.0");

    expect(achievementIds.has(4_010_101)).toBe(true);
    const march = characters.byId.get("1001");
    expect(getLocalizedValue(march?.name, "en")).toBe("March 7th");
    expect(getLocalizedValue(march?.name, "zh-CN")).toBe("三月七");
    expect(march?.path_id).toBe("Knight");
    expect(march?.release_version).toBe("1.0");
    // Tutorial/preloaded records must use playable availability, not client presence.
    expect(characters.byId.get("1005")?.release_version).toBe("1.2");
    expect(characters.byId.get("1006")?.release_version).toBe("1.1");
    expect(characters.byId.get("1203")?.release_version).toBe("1.1");
    expect(characters.byId.get("1224")?.release_version).toBe("2.4");
    expect(characters.byId.get("8005")?.release_version).toBe("2.2");
    expect(lightCones.byId.get("22000")?.release_version).toBe("1.1");
    expect(lightCones.byId.get("22002")?.release_version).toBe("2.2");
    expect(propertyTables.pathById.get("Knight")).toBeDefined();
    expect(propertyTables.combatTypeById.get("Ice")).toBeDefined();
    const stanceBreak = propertyTables.propertyById.get(
      "StanceBreakAddedRatio"
    );
    expect(stanceBreak?.icon_path).toBe("0");
    expect(stanceBreak?.usable_icon_path).toBeNull();

    const expandedCharacters = characters.values;

    const skills = expandedCharacters.flatMap((character) => character.skills);
    const ranks = expandedCharacters.flatMap((character) => character.ranks);
    const traces = expandedCharacters.flatMap((character) => character.traces);
    const servants = expandedCharacters.flatMap(
      (character) => character.servants
    );
    const enhancements = expandedCharacters.flatMap(
      (character) => character.enhancements
    );
    expect(skills).toHaveLength(648);
    expect(ranks).toHaveLength(588);
    expect(traces).toHaveLength(810);
    expect(traces.flatMap((trace) => trace.levels)).toHaveLength(4_098);
    expect(
      expandedCharacters.flatMap((character) => character.trace_stats)
    ).toHaveLength(295);
    expect(march?.trace_stats).toEqual([
      { property_id: "DefenceAddedRatio", value: 0.225 },
      { property_id: "IceAddedRatio", value: 0.224 },
      { property_id: "StatusResistanceBase", value: 0.1 },
    ]);
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
    expect(enhancements.flatMap((entry) => entry.traces)).toHaveLength(80);
    expect(enhancements.flatMap((entry) => entry.trace_stats)).toHaveLength(30);
    expect(
      enhancements.flatMap((entry) =>
        entry.traces.flatMap((trace) => trace.levels)
      )
    ).toHaveLength(400);
    for (const owner of [...expandedCharacters, ...enhancements]) {
      expect(
        new Set(owner.trace_stats.map((stat) => stat.property_id)).size
      ).toBe(owner.trace_stats.length);
      for (const stat of owner.trace_stats) {
        expect(propertyTables.propertyById.has(stat.property_id)).toBe(true);
        expect(Object.keys(stat).sort()).toEqual(["property_id", "value"]);
        expect(Number.isFinite(stat.value)).toBe(true);
      }
      const traceIds = new Set(owner.traces.map((trace) => trace.id));
      for (const trace of owner.traces)
        for (const prerequisite of trace.prerequisite_ids)
          expect(traceIds.has(prerequisite)).toBe(true);
    }
    for (const owner of [...expandedCharacters, ...enhancements, ...servants])
      for (const skill of owner.skills) {
        expect(skill.normal_max_level).toBeGreaterThanOrEqual(1);
        expect(skill.max_level).toBeGreaterThanOrEqual(skill.normal_max_level);
        expect(skill.levels.map((level) => level.level)).toEqual(
          Array.from({ length: skill.max_level }, (_, index) => index + 1)
        );
      }
    expect(march?.skills.find((skill) => skill.id === "100101")).toMatchObject({
      normal_max_level: 6,
      max_level: 7,
    });
    expect(march?.skills.find((skill) => skill.id === "100102")).toMatchObject({
      normal_max_level: 10,
      max_level: 12,
    });

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
    expect(servantDescriptionFallback?.description.en.value).toBe(
      servantDescriptionFallback?.simple_description?.en.value
    );
    expect(servantDescriptionFallback?.description["zh-CN"].value).toBe(
      servantDescriptionFallback?.simple_description?.["zh-CN"].value
    );

    expect(
      lightCones.values.flatMap(
        (lightCone) => lightCone.effect.superimpositions
      )
    ).toHaveLength(850);
    expect(
      lightCones.values.every(
        (lightCone) =>
          lightCone.effect.superimpositions.length ===
          lightCone.max_superimposition
      )
    ).toBe(true);
    const arrowsEffect = lightCones.byId.get("20000")?.effect;
    expect(arrowsEffect?.description.en.value).toContain("#1[i]%");
    expect(arrowsEffect?.description["zh-CN"].value).toContain("#1[i]%");
    expect(
      arrowsEffect?.superimpositions.map((level) => level.parameters)
    ).toEqual([
      [0.12, 3],
      [0.15, 3],
      [0.18, 3],
      [0.21, 3],
      [0.24, 3],
    ]);
    for (const cone of lightCones.values)
      for (const level of cone.effect.superimpositions) {
        // This source revision shares both language templates across every S level.
        expect(level.name).toBeNull();
        expect(level.description).toBeNull();
        expect(cone.effect.name.en.value).not.toBe("");
        expect(cone.effect.description["zh-CN"].value).not.toBe("");
      }
  });

  it("exposes calculator affixes and scoring without archive EXP or cost tables", async () => {
    const progression = await loadProgression();
    expect(progression.relic_main_affixes).toHaveLength(117);
    expect(progression.relic_sub_affixes).toHaveLength(48);
    expect(progression.relic_scoring.main_affix_base_values).toHaveLength(20);
    expect(progression.relic_scoring.sub_affix_base_values).toHaveLength(12);
    expect(progression.relic_scoring.main_affix_character_weights).toHaveLength(
      98
    );
    expect(progression.relic_scoring.sub_affix_character_weights).toHaveLength(
      98
    );
    expect(Object.keys(progression).sort()).toEqual([
      "relic_main_affixes",
      "relic_scoring",
      "relic_sub_affixes",
    ]);
  });

  it("keeps player content and stat scaling while omitting technical source and material payloads", async () => {
    const [
      characters,
      lightCones,
      relicSets,
      relicPieces,
      properties,
      progression,
      mode,
    ] = await Promise.all([
      loadCharacters(),
      loadLightCones(),
      loadRelicSets(),
      loadRelicPieces(),
      loadPropertyTables(),
      loadProgression(),
      loadCurrencyWarCatalog(),
    ]);
    const keys = new Set(
      payloadKeys([
        characters.values,
        lightCones.values,
        relicSets.values,
        relicPieces.values,
        properties.properties,
        progression,
        mode,
      ])
    );
    for (const obsolete of [
      "provenance",
      "source_table",
      "source_id",
      "source_revision",
      "source_path",
      "source_key",
      "source_reference",
      "source_url",
      "source_version",
      "costs",
      "promotions",
      "experience_type",
      "rank_up_material_ids",
      "ability_name",
    ])
      expect(keys.has(obsolete), obsolete).toBe(false);
    const arrows = lightCones.byId.get("20000");
    expect(arrows?.stat_scaling).toHaveLength(7);
    expect(arrows?.stat_scaling.at(-1)).toMatchObject({
      ascension: 6,
      max_level: 80,
      stats: { hp: { base_value: 391.68, level_add: 5.76 } },
    });
    expect(characters.byId.get("1001")?.stat_scaling.at(-1)?.max_level).toBe(
      80
    );
    expect(Object.keys(HSR_REFERENCE_MANIFEST).sort()).toEqual([
      "bundle_id",
      "counts",
      "game_id",
      "locales",
      "schema_version",
    ]);
  });
});

it("includes collaboration characters in the released catalog with stat scaling and complete combat descriptions", async () => {
  setBetaEnabled(false);
  const catalog = await loadCharacters();
  for (const id of ["1014", "1015", "1508", "1509"]) {
    const character = catalog.byId.get(id);
    expect(
      character,
      `missing released collaboration character ${id}`
    ).toBeDefined();
    if (!character) throw new Error(`Incomplete character ${id}`);
    expect(character.stat_scaling).toHaveLength(7);
    expect(character.ranks).toHaveLength(6);
    expect(character.skills.length).toBeGreaterThan(0);
    expect(character.traces.length).toBeGreaterThan(0);
  }
});
