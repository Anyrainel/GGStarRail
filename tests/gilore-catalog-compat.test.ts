import { afterEach, describe, expect, it, vi } from "vitest";
import currentManifest from "@/generated/hsr-reference/manifest.json";
import legacyFixture from "./fixtures/gilore-v1-runtime.json";

const V1_COUNT_KEYS = [
  "cavern_relic_sets",
  "character_experience_tables",
  "characters",
  "combat_types",
  "light_cone_experience_tables",
  "light_cones",
  "logical_relic_pieces",
  "paths",
  "planar_ornament_sets",
  "properties",
  "relic_experience_tables",
  "relic_main_affix_character_weights",
  "relic_main_affix_score_bases",
  "relic_main_affixes",
  "relic_piece_variants",
  "relic_sets",
  "relic_slots",
  "relic_sub_affix_character_weights",
  "relic_sub_affix_score_bases",
  "relic_sub_affixes",
] as const;

const mockedModuleIds = [
  "@/generated/hsr-reference/manifest.json",
  "@/generated/hsr-reference/characters.json",
  "@/generated/hsr-reference/light_cones.json",
  "@/generated/hsr-reference/progression.json",
  "@/generated/hsr-reference/property_tables.json",
  "@/providers/gilore/assets",
] as const;

afterEach(() => {
  for (const moduleId of mockedModuleIds) vi.doUnmock(moduleId);
  vi.resetModules();
});

describe("GIlore schema-versioned runtime catalogs", () => {
  it("loads legacy v1 shapes without claiming v1.1 expansions exist", async () => {
    const legacyManifest = {
      ...currentManifest,
      counts: Object.fromEntries(
        V1_COUNT_KEYS.map((key) => [key, currentManifest.counts[key]])
      ),
      schema_version: "1.0.0",
    };
    vi.doMock("@/generated/hsr-reference/manifest.json", () => ({
      default: legacyManifest,
    }));
    vi.doMock("@/generated/hsr-reference/characters.json", () => ({
      default: legacyFixture.characters,
    }));
    vi.doMock("@/generated/hsr-reference/light_cones.json", () => ({
      default: legacyFixture.lightCones,
    }));
    vi.doMock("@/generated/hsr-reference/progression.json", () => ({
      default: legacyFixture.progression,
    }));
    vi.doMock("@/generated/hsr-reference/property_tables.json", () => ({
      default: legacyFixture.propertyTables,
    }));
    vi.doMock("@/providers/gilore/assets", () => ({
      loadCatalogAssetLookup: vi.fn(async () => new Map()),
    }));

    const provider = await import("@/providers/gilore/catalog");
    const [characters, lightCones, progression, properties] = await Promise.all(
      [
        provider.loadCharacters(),
        provider.loadLightCones(),
        provider.loadProgression(),
        provider.loadPropertyTables(),
      ]
    );

    expect(provider.HSR_REFERENCE_MANIFEST.schema_version).toBe("1.0.0");
    expect(characters.schemaVersion).toBe("1.0.0");
    expect(lightCones.schemaVersion).toBe("1.0.0");
    expect(properties.schemaVersion).toBe("1.0.0");

    const character = characters.values[0];
    if (!character) throw new Error("missing legacy Character fixture");
    expect(provider.isCharacterDefinitionV1_1(character)).toBe(false);
    expect(character.skills[0]?.levels[0]?.parameters).toEqual([0.5]);
    expect("source_table" in (character.skills[0] ?? {})).toBe(false);
    expect("ranks" in character).toBe(false);

    const lightCone = lightCones.values[0];
    if (!lightCone) throw new Error("missing legacy Light Cone fixture");
    expect(provider.isLightConeDefinitionV1_1(lightCone)).toBe(false);
    expect(lightCone.effect.superimpositions[0]?.parameters).toEqual([0.12]);
    expect("ability_name" in (lightCone.effect.superimpositions[0] ?? {})).toBe(
      false
    );
    expect("rank_up_material_ids" in lightCone).toBe(false);

    expect(provider.isProgressionTablesV1_1(progression)).toBe(false);
    expect(progression.character_experience[0]?.levels[0]?.experience).toBe(0);
    expect("items" in progression).toBe(false);

    const property = properties.properties[0];
    if (!property) throw new Error("missing legacy property fixture");
    expect(provider.isPropertyDefinitionV1_1(property)).toBe(false);
    expect(property.icon_path).toBe("0");
    expect("usable_icon_path" in property).toBe(false);
  });
});
