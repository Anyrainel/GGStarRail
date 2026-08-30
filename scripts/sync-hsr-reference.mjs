import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const AUDITED_SOURCE_REVISION =
  "014e33e2404f8cd668bf06fc2ea6db53b6bc3992";

const COMMON_EXPECTED_COUNTS = Object.freeze({
  cavern_relic_sets: 32,
  character_experience_tables: 2,
  characters: 93,
  combat_types: 7,
  light_cone_experience_tables: 3,
  light_cones: 169,
  logical_relic_pieces: 184,
  paths: 9,
  planar_ornament_sets: 28,
  properties: 56,
  relic_experience_tables: 4,
  relic_main_affix_character_weights: 97,
  relic_main_affix_score_bases: 20,
  relic_main_affixes: 117,
  relic_piece_variants: 742,
  relic_sets: 60,
  relic_slots: 6,
  relic_sub_affix_character_weights: 97,
  relic_sub_affix_score_bases: 12,
  relic_sub_affixes: 48,
});

export const EXPECTED_COUNTS_BY_SCHEMA = Object.freeze({
  "1.0.0": COMMON_EXPECTED_COUNTS,
  "1.1.0": Object.freeze({
    ...COMMON_EXPECTED_COUNTS,
    character_enhancement_variants: 10,
    character_ranks: 558,
    character_servant_attachments: 8,
    character_servant_skills: 48,
    character_servants: 7,
    character_skills: 611,
    character_skills_using_description_fallback: 92,
    character_trace_levels: 4818,
    character_trace_nodes: 1699,
    enhanced_character_ranks: 60,
    enhanced_character_skills: 64,
    enhanced_character_trace_levels: 500,
    enhanced_character_trace_nodes: 180,
    light_cone_superimpositions: 845,
    progression_items: 238,
    properties_with_real_icons: 55,
  }),
});

export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze(
  Object.keys(EXPECTED_COUNTS_BY_SCHEMA)
);

const MEMBER_FILES = Object.freeze([
  "characters.json",
  "corroboration.json",
  "diagnostics.json",
  "light_cones.json",
  "progression.json",
  "property_tables.json",
  "relic_pieces.json",
  "relic_sets.json",
]);
const MEMBER_COLLECTIONS = Object.freeze({
  "characters.json": "characters",
  "diagnostics.json": "diagnostics",
  "light_cones.json": "light_cones",
  "progression.json": "progression",
  "property_tables.json": "property_tables",
  "relic_pieces.json": "relic_pieces",
  "relic_sets.json": "relic_sets",
});
const EXPECTED_DIAGNOSTICS_BY_SCHEMA = Object.freeze({
  "1.0.0": Object.freeze({
    resolved_deobfuscation: 2,
    source_disagreements: 4,
    source_gaps: 12,
    unresolved_deobfuscation: 0,
  }),
  "1.1.0": Object.freeze({
    resolved_deobfuscation: 2,
    source_disagreements: 4,
    source_gaps: 14,
    unresolved_deobfuscation: 0,
  }),
});

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const defaultSourceDirectory = path.resolve(
  repositoryRoot,
  "..",
  "GIlore",
  "data",
  "reference",
  "honkai_star_rail",
  "v1"
);
const defaultOutputDirectory = path.resolve(
  repositoryRoot,
  "src",
  "generated",
  "hsr-reference"
);

function fail(message) {
  throw new Error(`HSR reference validation failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertObject(value, label) {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`
  );
  return value;
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
  return value;
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(assertObject(value, label)).sort();
  const sortedExpected = [...expected].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(sortedExpected),
    `${label} keys differ: expected ${sortedExpected.join(", ")}; got ${actual.join(", ")}`
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJson(bytes, filePath) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(`${filePath} is not valid JSON: ${error.message}`);
  }
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

function assertSupportedSchema(schemaVersion, label) {
  const expectedCounts = EXPECTED_COUNTS_BY_SCHEMA[schemaVersion];
  assert(
    expectedCounts,
    `${label} has unsupported schema version ${schemaVersion}; expected one of ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`
  );
  return expectedCounts;
}

function assertUniqueIds(values, label) {
  const seen = new Set();
  for (const [index, entry] of assertArray(values, label).entries()) {
    const object = assertObject(entry, `${label}[${index}]`);
    assert(
      typeof object.id === "string" && object.id.length > 0,
      `${label}[${index}].id must be a non-empty string`
    );
    assert(!seen.has(object.id), `${label} contains duplicate id ${object.id}`);
    seen.add(object.id);
  }
  return seen;
}

function assertLocalizedIdentities(value, sourceRevision, trail = "value") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertLocalizedIdentities(entry, sourceRevision, `${trail}[${index}]`);
    });
    return;
  }
  if (value === null || typeof value !== "object") return;

  const hasEnglish = Object.hasOwn(value, "en");
  const hasChinese = Object.hasOwn(value, "zh-CN");
  if (hasEnglish || hasChinese) {
    assert(
      hasEnglish && hasChinese,
      `${trail} has incomplete bilingual identity`
    );
    const english = assertObject(value.en, `${trail}.en`);
    const chinese = assertObject(value["zh-CN"], `${trail}.zh-CN`);
    assert(
      typeof english.value === "string" && english.value.length > 0,
      `${trail}.en.value must be non-empty`
    );
    assert(
      typeof chinese.value === "string" && chinese.value.length > 0,
      `${trail}.zh-CN.value must be non-empty`
    );
    const enProvenance = assertObject(
      english.provenance,
      `${trail}.en.provenance`
    );
    const zhProvenance = assertObject(
      chinese.provenance,
      `${trail}.zh-CN.provenance`
    );
    assert(enProvenance.locale === "en", `${trail}.en locale identity drift`);
    assert(
      enProvenance.source_locale === "EN",
      `${trail}.en source locale identity drift`
    );
    assert(
      zhProvenance.locale === "zh-CN",
      `${trail}.zh-CN locale identity drift`
    );
    assert(
      zhProvenance.source_locale === "CHS",
      `${trail}.zh-CN source locale identity drift`
    );
    for (const provenance of [enProvenance, zhProvenance]) {
      assert(
        provenance.source_revision === sourceRevision,
        `${trail} localized source revision mismatch`
      );
      assert(
        provenance.source_id === "turn_based_game_data",
        `${trail} localized primary source mismatch`
      );
    }
    assert(
      enProvenance.source_key === zhProvenance.source_key &&
        enProvenance.source_reference === zhProvenance.source_reference,
      `${trail} cross-locale source identity drift`
    );
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    assertLocalizedIdentities(entry, sourceRevision, `${trail}.${key}`);
  }
}

function computeEntityCount(fileName, value, schemaVersion) {
  if (
    fileName === "characters.json" ||
    fileName === "light_cones.json" ||
    fileName === "relic_pieces.json" ||
    fileName === "relic_sets.json"
  ) {
    return assertArray(value, `${fileName}.value`).length;
  }
  if (fileName === "property_tables.json") {
    return assertArray(
      assertObject(value, `${fileName}.value`).properties,
      `${fileName}.value.properties`
    ).length;
  }
  if (fileName === "progression.json") {
    const progression = assertObject(value, `${fileName}.value`);
    const scoring = assertObject(
      progression.relic_scoring,
      `${fileName}.value.relic_scoring`
    );
    const countedCollections = [
      progression.character_experience,
      progression.light_cone_experience,
      progression.relic_experience,
      progression.relic_main_affixes,
      progression.relic_sub_affixes,
      scoring.main_affix_base_values,
      scoring.sub_affix_base_values,
      scoring.main_affix_character_weights,
      scoring.sub_affix_character_weights,
    ];
    if (schemaVersion === "1.1.0") {
      countedCollections.unshift(progression.items);
    }
    return countedCollections.reduce(
      (total, entries, index) =>
        total + assertArray(entries, `${fileName}.counted[${index}]`).length,
      0
    );
  }
  if (fileName === "diagnostics.json") {
    const diagnostics = assertObject(value, `${fileName}.value`);
    return (
      assertArray(
        diagnostics.unresolved_deobfuscation,
        `${fileName}.value.unresolved_deobfuscation`
      ).length +
      assertArray(
        diagnostics.source_disagreements,
        `${fileName}.value.source_disagreements`
      ).length +
      assertArray(diagnostics.source_gaps, `${fileName}.value.source_gaps`)
        .length
    );
  }
  return null;
}

function computeCounts(documents, schemaVersion) {
  const characters = assertArray(
    documents["characters.json"].value,
    "characters"
  );
  const lightCones = assertArray(
    documents["light_cones.json"].value,
    "light cones"
  );
  const relicSets = assertArray(
    documents["relic_sets.json"].value,
    "relic sets"
  );
  const relicPieces = assertArray(
    documents["relic_pieces.json"].value,
    "relic pieces"
  );
  const propertyTables = assertObject(
    documents["property_tables.json"].value,
    "property tables"
  );
  const progression = assertObject(
    documents["progression.json"].value,
    "progression"
  );
  const scoring = assertObject(progression.relic_scoring, "relic scoring");

  const counts = {
    cavern_relic_sets: relicSets.filter(
      (entry) => entry.kind === "cavern_relic"
    ).length,
    character_experience_tables: assertArray(
      progression.character_experience,
      "character experience"
    ).length,
    characters: characters.length,
    combat_types: assertArray(propertyTables.combat_types, "combat types")
      .length,
    light_cone_experience_tables: assertArray(
      progression.light_cone_experience,
      "light cone experience"
    ).length,
    light_cones: lightCones.length,
    logical_relic_pieces: new Set(
      relicPieces.map((entry) => `${entry.set_id}\0${entry.slot}`)
    ).size,
    paths: assertArray(propertyTables.paths, "paths").length,
    planar_ornament_sets: relicSets.filter(
      (entry) => entry.kind === "planar_ornament"
    ).length,
    properties: assertArray(propertyTables.properties, "properties").length,
    relic_experience_tables: assertArray(
      progression.relic_experience,
      "relic experience"
    ).length,
    relic_main_affix_character_weights: assertArray(
      scoring.main_affix_character_weights,
      "main affix character weights"
    ).length,
    relic_main_affix_score_bases: assertArray(
      scoring.main_affix_base_values,
      "main affix score bases"
    ).length,
    relic_main_affixes: assertArray(
      progression.relic_main_affixes,
      "main affixes"
    ).length,
    relic_piece_variants: relicPieces.length,
    relic_sets: relicSets.length,
    relic_slots: assertArray(propertyTables.relic_slots, "relic slots").length,
    relic_sub_affix_character_weights: assertArray(
      scoring.sub_affix_character_weights,
      "sub affix character weights"
    ).length,
    relic_sub_affix_score_bases: assertArray(
      scoring.sub_affix_base_values,
      "sub affix score bases"
    ).length,
    relic_sub_affixes: assertArray(progression.relic_sub_affixes, "sub affixes")
      .length,
  };
  if (schemaVersion === "1.0.0") return counts;

  const baseSkills = characters.flatMap((character) =>
    assertArray(character.skills, `character ${character.id} skills`)
  );
  const baseRanks = characters.flatMap((character) =>
    assertArray(character.ranks, `character ${character.id} ranks`)
  );
  const baseTraces = characters.flatMap((character) =>
    assertArray(character.traces, `character ${character.id} traces`)
  );
  const servantAttachments = characters.flatMap((character) =>
    assertArray(character.servants, `character ${character.id} servants`)
  );
  const servantSkills = servantAttachments.flatMap((servant) =>
    assertArray(servant.skills, `servant ${servant.id} skills`)
  );
  const enhancements = characters.flatMap((character) =>
    assertArray(
      character.enhancements,
      `character ${character.id} enhancements`
    )
  );
  const enhancedSkills = enhancements.flatMap((enhancement) =>
    assertArray(
      enhancement.skills,
      `enhancement ${enhancement.enhanced_id} skills`
    )
  );
  const enhancedRanks = enhancements.flatMap((enhancement) =>
    assertArray(
      enhancement.ranks,
      `enhancement ${enhancement.enhanced_id} ranks`
    )
  );
  const enhancedTraces = enhancements.flatMap((enhancement) =>
    assertArray(
      enhancement.traces,
      `enhancement ${enhancement.enhanced_id} traces`
    )
  );

  return {
    ...counts,
    character_enhancement_variants: enhancements.length,
    character_ranks: baseRanks.length,
    character_servant_attachments: servantAttachments.length,
    character_servant_skills: new Set(servantSkills.map((skill) => skill.id))
      .size,
    character_servants: new Set(servantAttachments.map((servant) => servant.id))
      .size,
    character_skills: baseSkills.length,
    character_skills_using_description_fallback: baseSkills.filter(
      (skill) => skill.display_description_source === "description"
    ).length,
    character_trace_levels: baseTraces.reduce(
      (total, trace) =>
        total + assertArray(trace.levels, `trace ${trace.id} levels`).length,
      0
    ),
    character_trace_nodes: baseTraces.length,
    enhanced_character_ranks: enhancedRanks.length,
    enhanced_character_skills: enhancedSkills.length,
    enhanced_character_trace_levels: enhancedTraces.reduce(
      (total, trace) =>
        total + assertArray(trace.levels, `trace ${trace.id} levels`).length,
      0
    ),
    enhanced_character_trace_nodes: enhancedTraces.length,
    light_cone_superimpositions: lightCones.reduce(
      (total, lightCone) =>
        total +
        assertArray(
          assertObject(lightCone.effect, `Light Cone ${lightCone.id} effect`)
            .superimpositions,
          `Light Cone ${lightCone.id} superimpositions`
        ).length,
      0
    ),
    progression_items: assertArray(progression.items, "progression items")
      .length,
    properties_with_real_icons: assertArray(
      propertyTables.properties,
      "properties"
    ).filter(
      (property) =>
        typeof property.usable_icon_path === "string" &&
        property.usable_icon_path.length > 0
    ).length,
  };
}

function assertCostReferences(costs, itemIds, label) {
  for (const [index, cost] of assertArray(costs, label).entries()) {
    const entry = assertObject(cost, `${label}[${index}]`);
    assertExactKeys(entry, ["count", "item_id"], `${label}[${index}]`);
    assert(
      typeof entry.item_id === "string" && itemIds.has(entry.item_id),
      `${label}[${index}] references unknown progression item ${entry.item_id}`
    );
    assert(
      Number.isInteger(entry.count) && entry.count >= 0,
      `${label}[${index}].count must be a non-negative integer`
    );
  }
}

function assertLegacyCatalogShapes(documents) {
  const characters = assertArray(
    documents["characters.json"].value,
    "characters"
  );
  const lightCones = assertArray(
    documents["light_cones.json"].value,
    "light cones"
  );
  const progression = assertObject(
    documents["progression.json"].value,
    "progression"
  );
  const propertyTables = assertObject(
    documents["property_tables.json"].value,
    "property tables"
  );
  assertExactKeys(
    progression,
    [
      "character_experience",
      "light_cone_experience",
      "relic_experience",
      "relic_main_affixes",
      "relic_scoring",
      "relic_sub_affixes",
    ],
    "progression"
  );
  assertExactKeys(
    propertyTables,
    ["combat_types", "paths", "properties", "relic_slots"],
    "property tables"
  );

  for (const character of characters) {
    assertExactKeys(
      character,
      [
        "combat_type_id",
        "description",
        "experience_type",
        "icon_path",
        "id",
        "max_energy",
        "max_promotion",
        "max_rank",
        "name",
        "path_id",
        "promotions",
        "rarity",
        "skills",
      ],
      `character ${character.id}`
    );
    for (const skill of assertArray(
      character.skills,
      `character ${character.id} skills`
    )) {
      assertExactKeys(
        skill,
        [
          "attack_type",
          "description",
          "effect_type",
          "id",
          "levels",
          "max_level",
          "name",
          "simple_description",
          "trigger_key",
        ],
        `character ${character.id} skill ${skill.id}`
      );
      assertObject(
        skill.description,
        `character ${character.id} skill ${skill.id}.description`
      );
      const levels = assertArray(
        skill.levels,
        `character ${character.id} skill ${skill.id}.levels`
      );
      assert(
        Number.isInteger(skill.max_level) && levels.length === skill.max_level,
        `character ${character.id} skill ${skill.id} level count does not match max_level`
      );
      for (const [index, level] of levels.entries()) {
        assertExactKeys(
          level,
          ["level", "parameters"],
          `character ${character.id} skill ${skill.id}.levels[${index}]`
        );
        assert(
          level.level === index + 1,
          `character ${character.id} skill ${skill.id} levels must be sequential from 1`
        );
      }
    }
  }

  for (const lightCone of lightCones) {
    assertExactKeys(
      lightCone,
      [
        "background_description",
        "description",
        "effect",
        "experience_type",
        "icon_path",
        "id",
        "max_promotion",
        "max_superimposition",
        "name",
        "path_id",
        "promotions",
        "rarity",
      ],
      `Light Cone ${lightCone.id}`
    );
    const effect = assertObject(
      lightCone.effect,
      `Light Cone ${lightCone.id} effect`
    );
    assertExactKeys(
      effect,
      ["description", "id", "name", "superimpositions"],
      `Light Cone ${lightCone.id} effect`
    );
    const superimpositions = assertArray(
      effect.superimpositions,
      `Light Cone ${lightCone.id} superimpositions`
    );
    assert(
      superimpositions.length === lightCone.max_superimposition,
      `Light Cone ${lightCone.id} superimposition count mismatch`
    );
    for (const [index, rank] of superimpositions.entries()) {
      assertExactKeys(
        rank,
        ["level", "parameters"],
        `Light Cone ${lightCone.id} superimposition ${index + 1}`
      );
      assert(
        rank.level === index + 1,
        `Light Cone ${lightCone.id} superimpositions must be sequential`
      );
    }
  }

  for (const property of assertArray(propertyTables.properties, "properties")) {
    assertExactKeys(
      property,
      [
        "display_order",
        "icon_path",
        "id",
        "is_battle_displayed",
        "is_displayed",
        "name",
        "relic_name",
        "value_kind",
      ],
      `property ${property.id}`
    );
    assert(
      typeof property.icon_path === "string" && property.icon_path.length > 0,
      `property ${property.id} has invalid icon_path`
    );
  }
}

function assertCharacterSkill(skill, sourceTable, itemIds, label) {
  const entry = assertObject(skill, label);
  assertExactKeys(
    entry,
    [
      "attack_type",
      "description",
      "display_description",
      "display_description_source",
      "effect_type",
      "extra_effect_ids",
      "hide_in_ui",
      "icon_path",
      "id",
      "levels",
      "max_level",
      "name",
      "rated_rank_ids",
      "rated_trace_ids",
      "simple_description",
      "simple_extra_effect_ids",
      "source_table",
      "tag",
      "trigger_key",
      "type_description",
      "ultimate_icon_path",
    ],
    label
  );
  assert(entry.source_table === sourceTable, `${label} source_table mismatch`);
  assertObject(entry.description, `${label}.description`);
  assertArray(entry.rated_trace_ids, `${label}.rated_trace_ids`);
  assertArray(entry.rated_rank_ids, `${label}.rated_rank_ids`);
  assertArray(entry.extra_effect_ids, `${label}.extra_effect_ids`);
  assertArray(
    entry.simple_extra_effect_ids,
    `${label}.simple_extra_effect_ids`
  );
  const selectedDescription =
    entry.display_description_source === "simple_description"
      ? entry.simple_description
      : entry.display_description_source === "description"
        ? entry.description
        : null;
  assert(
    selectedDescription,
    `${label} has invalid display description source`
  );
  assert(
    JSON.stringify(entry.display_description) ===
      JSON.stringify(selectedDescription),
    `${label} display description drift`
  );
  const levels = assertArray(entry.levels, `${label}.levels`);
  assert(
    Number.isInteger(entry.max_level) && levels.length === entry.max_level,
    `${label} level count does not match max_level`
  );
  for (const [index, level] of levels.entries()) {
    const levelEntry = assertObject(level, `${label}.levels[${index}]`);
    assertExactKeys(
      levelEntry,
      [
        "display_parameters",
        "level",
        "level_up_costs",
        "parameters",
        "simple_parameters",
      ],
      `${label}.levels[${index}]`
    );
    assert(
      levelEntry.level === index + 1,
      `${label}.levels must be sequential from 1`
    );
    const parameters = assertArray(
      levelEntry.parameters,
      `${label}.levels[${index}].parameters`
    );
    const simpleParameters = assertArray(
      levelEntry.simple_parameters,
      `${label}.levels[${index}].simple_parameters`
    );
    const selectedParameters =
      entry.display_description_source === "simple_description"
        ? simpleParameters
        : parameters;
    assert(
      JSON.stringify(levelEntry.display_parameters) ===
        JSON.stringify(selectedParameters),
      `${label}.levels[${index}] display parameter drift`
    );
    assertCostReferences(
      levelEntry.level_up_costs,
      itemIds,
      `${label}.levels[${index}].level_up_costs`
    );
  }
}

function assertCharacterRank(rank, itemIds, label) {
  const entry = assertObject(rank, label);
  assertExactKeys(
    entry,
    [
      "ability_names",
      "description",
      "extra_effect_ids",
      "icon_path",
      "id",
      "name",
      "parameters",
      "rank",
      "skill_level_additions",
      "unlock_costs",
    ],
    label
  );
  assertCostReferences(entry.unlock_costs, itemIds, `${label}.unlock_costs`);
  assertObject(entry.skill_level_additions, `${label}.skill_level_additions`);
  assertArray(entry.parameters, `${label}.parameters`);
  assertArray(entry.extra_effect_ids, `${label}.extra_effect_ids`);
  assertArray(entry.ability_names, `${label}.ability_names`);
}

function assertCharacterTrace(trace, itemIds, propertyIds, label) {
  const entry = assertObject(trace, label);
  assertExactKeys(
    entry,
    [
      "ability_name",
      "anchor_type",
      "default_unlock",
      "description",
      "extra_effect_ids",
      "icon_path",
      "id",
      "levels",
      "max_level",
      "name",
      "point_type",
      "prerequisite_ids",
      "simple_extra_effect_ids",
      "skill_ids",
      "trigger_key",
    ],
    label
  );
  const levels = assertArray(entry.levels, `${label}.levels`);
  assert(
    Number.isInteger(entry.max_level) && levels.length === entry.max_level,
    `${label} level count does not match max_level`
  );
  assertArray(entry.prerequisite_ids, `${label}.prerequisite_ids`);
  assertArray(entry.skill_ids, `${label}.skill_ids`);
  assertArray(entry.extra_effect_ids, `${label}.extra_effect_ids`);
  assertArray(
    entry.simple_extra_effect_ids,
    `${label}.simple_extra_effect_ids`
  );
  for (const [index, level] of levels.entries()) {
    const levelEntry = assertObject(level, `${label}.levels[${index}]`);
    assertExactKeys(
      levelEntry,
      [
        "character_level_required",
        "costs",
        "level",
        "parameters",
        "promotion_required",
        "properties",
      ],
      `${label}.levels[${index}]`
    );
    assert(
      levelEntry.level === index + 1,
      `${label}.levels must be sequential from 1`
    );
    assertCostReferences(
      levelEntry.costs,
      itemIds,
      `${label}.levels[${index}].costs`
    );
    assertArray(levelEntry.parameters, `${label}.levels[${index}].parameters`);
    for (const property of assertArray(
      levelEntry.properties,
      `${label}.levels[${index}].properties`
    )) {
      const propertyEntry = assertObject(
        property,
        `${label}.levels[${index}].property`
      );
      assertExactKeys(
        propertyEntry,
        ["property_id", "value"],
        `${label}.levels[${index}].property`
      );
      assert(
        propertyIds.has(propertyEntry.property_id),
        `${label} references unknown trace property ${propertyEntry.property_id}`
      );
    }
  }
}

function assertExpandedCatalogRelations(documents) {
  const characters = assertArray(
    documents["characters.json"].value,
    "characters"
  );
  const lightCones = assertArray(
    documents["light_cones.json"].value,
    "light cones"
  );
  const propertyTables = assertObject(
    documents["property_tables.json"].value,
    "property tables"
  );
  const progression = assertObject(
    documents["progression.json"].value,
    "progression"
  );
  assertExactKeys(
    propertyTables,
    ["combat_types", "paths", "properties", "relic_slots"],
    "property tables"
  );
  assertExactKeys(
    progression,
    [
      "character_experience",
      "items",
      "light_cone_experience",
      "relic_experience",
      "relic_main_affixes",
      "relic_scoring",
      "relic_sub_affixes",
    ],
    "progression"
  );
  const items = assertArray(progression.items, "progression.items");
  const itemIds = assertUniqueIds(items, "progression.items");
  const propertyIds = new Set(
    assertArray(propertyTables.properties, "properties").map(
      (property) => property.id
    )
  );
  for (const [index, item] of items.entries()) {
    const entry = assertObject(item, `progression.items[${index}]`);
    assertExactKeys(
      entry,
      [
        "background_description",
        "character_experience",
        "description",
        "icon_path",
        "id",
        "light_cone_experience",
        "light_cone_feed_credit_cost",
        "main_type",
        "name",
        "purpose_type",
        "rarity",
        "source_table",
        "sub_type",
      ],
      `progression.items[${index}]`
    );
    assert(
      entry.source_table === "ItemConfig" ||
        entry.source_table === "ItemConfigAvatarRank",
      `progression item ${entry.id} has unsupported source_table`
    );
  }

  const allBaseSkills = [];
  const allBaseRanks = [];
  const allBaseTraces = [];
  const allEnhancedSkills = [];
  const allEnhancedRanks = [];
  const allEnhancedTraces = [];
  const enhancedIds = new Set();
  const servantById = new Map();
  const servantSkillById = new Map();

  for (const character of characters) {
    assertExactKeys(
      character,
      [
        "combat_type_id",
        "description",
        "enhancements",
        "experience_type",
        "icon_path",
        "id",
        "max_energy",
        "max_promotion",
        "max_rank",
        "name",
        "path_id",
        "promotions",
        "ranks",
        "rarity",
        "servants",
        "skills",
        "traces",
      ],
      `character ${character.id}`
    );
    for (const [index, promotion] of assertArray(
      character.promotions,
      `character ${character.id} promotions`
    ).entries()) {
      assertCostReferences(
        assertObject(
          promotion,
          `character ${character.id} promotions[${index}]`
        ).costs,
        itemIds,
        `character ${character.id} promotions[${index}].costs`
      );
    }

    const skills = assertArray(
      character.skills,
      `character ${character.id} skills`
    );
    assertUniqueIds(skills, `character ${character.id} skills`);
    for (const skill of skills) {
      assertCharacterSkill(
        skill,
        "AvatarSkillConfig",
        itemIds,
        `character ${character.id} skill ${skill.id}`
      );
    }
    allBaseSkills.push(...skills);

    const ranks = assertArray(
      character.ranks,
      `character ${character.id} ranks`
    );
    assertUniqueIds(ranks, `character ${character.id} ranks`);
    for (const rank of ranks) {
      assertCharacterRank(
        rank,
        itemIds,
        `character ${character.id} rank ${rank.id}`
      );
    }
    allBaseRanks.push(...ranks);

    const traces = assertArray(
      character.traces,
      `character ${character.id} traces`
    );
    const traceIds = assertUniqueIds(
      traces,
      `character ${character.id} traces`
    );
    for (const trace of traces) {
      assertCharacterTrace(
        trace,
        itemIds,
        propertyIds,
        `character ${character.id} trace ${trace.id}`
      );
      for (const prerequisiteId of trace.prerequisite_ids) {
        assert(
          traceIds.has(prerequisiteId),
          `character ${character.id} trace ${trace.id} has unknown prerequisite ${prerequisiteId}`
        );
      }
    }
    allBaseTraces.push(...traces);

    for (const servant of assertArray(
      character.servants,
      `character ${character.id} servants`
    )) {
      assertExactKeys(
        servant,
        ["icon_path", "id", "name", "skills"],
        `character ${character.id} servant ${servant.id}`
      );
      const existingServant = servantById.get(servant.id);
      assert(
        !existingServant ||
          JSON.stringify(existingServant) === JSON.stringify(servant),
        `servant ${servant.id} definition drift across attachments`
      );
      servantById.set(servant.id, servant);
      const servantSkills = assertArray(
        servant.skills,
        `servant ${servant.id} skills`
      );
      assertUniqueIds(servantSkills, `servant ${servant.id} skills`);
      for (const skill of servantSkills) {
        assertCharacterSkill(
          skill,
          "AvatarServantSkillConfig",
          itemIds,
          `servant ${servant.id} skill ${skill.id}`
        );
        const existingSkill = servantSkillById.get(skill.id);
        assert(
          !existingSkill ||
            JSON.stringify(existingSkill) === JSON.stringify(skill),
          `servant skill ${skill.id} definition drift across attachments`
        );
        servantSkillById.set(skill.id, skill);
      }
    }

    for (const enhancement of assertArray(
      character.enhancements,
      `character ${character.id} enhancements`
    )) {
      assertExactKeys(
        enhancement,
        [
          "activity_id",
          "enhanced_id",
          "max_energy",
          "rank_changes",
          "ranks",
          "season_id",
          "skill_changes",
          "skills",
          "summaries",
          "trace_changes",
          "traces",
        ],
        `character ${character.id} enhancement ${enhancement.enhanced_id}`
      );
      const enhancementKey = `${character.id}:${enhancement.enhanced_id}`;
      assert(
        !enhancedIds.has(enhancementKey),
        `duplicate enhancement id ${enhancementKey}`
      );
      enhancedIds.add(enhancementKey);
      assertArray(
        enhancement.summaries,
        `enhancement ${enhancement.enhanced_id} summaries`
      );
      const enhancedSkills = assertArray(
        enhancement.skills,
        `enhancement ${enhancement.enhanced_id} skills`
      );
      const enhancedSkillIds = assertUniqueIds(
        enhancedSkills,
        `enhancement ${enhancement.enhanced_id} skills`
      );
      for (const skill of enhancedSkills) {
        assertCharacterSkill(
          skill,
          "AvatarSkillConfig",
          itemIds,
          `enhancement ${enhancement.enhanced_id} skill ${skill.id}`
        );
      }
      allEnhancedSkills.push(...enhancedSkills);

      const enhancedRanks = assertArray(
        enhancement.ranks,
        `enhancement ${enhancement.enhanced_id} ranks`
      );
      const enhancedRankIds = assertUniqueIds(
        enhancedRanks,
        `enhancement ${enhancement.enhanced_id} ranks`
      );
      for (const rank of enhancedRanks) {
        assertCharacterRank(
          rank,
          itemIds,
          `enhancement ${enhancement.enhanced_id} rank ${rank.id}`
        );
      }
      allEnhancedRanks.push(...enhancedRanks);

      const enhancedTraces = assertArray(
        enhancement.traces,
        `enhancement ${enhancement.enhanced_id} traces`
      );
      const enhancedTraceIds = assertUniqueIds(
        enhancedTraces,
        `enhancement ${enhancement.enhanced_id} traces`
      );
      for (const trace of enhancedTraces) {
        assertCharacterTrace(
          trace,
          itemIds,
          propertyIds,
          `enhancement ${enhancement.enhanced_id} trace ${trace.id}`
        );
        for (const prerequisiteId of trace.prerequisite_ids) {
          assert(
            enhancedTraceIds.has(prerequisiteId),
            `enhancement ${enhancement.enhanced_id} trace ${trace.id} has unknown prerequisite ${prerequisiteId}`
          );
        }
      }
      allEnhancedTraces.push(...enhancedTraces);

      const allowedSkillIds = new Set([
        ...skills.map((skill) => skill.id),
        ...enhancedSkillIds,
      ]);
      const allowedTraceIds = new Set([...traceIds, ...enhancedTraceIds]);
      const allowedRankIds = new Set([
        ...ranks.map((rank) => rank.id),
        ...enhancedRankIds,
      ]);
      for (const [index, change] of assertArray(
        enhancement.skill_changes,
        `enhancement ${enhancement.enhanced_id} skill_changes`
      ).entries()) {
        assertExactKeys(
          change,
          [
            "description_after",
            "description_before",
            "simple_description_after",
            "simple_description_before",
            "skill_id",
            "trace_id",
          ],
          `enhancement ${enhancement.enhanced_id} skill_changes[${index}]`
        );
        assert(
          allowedSkillIds.has(change.skill_id) &&
            allowedTraceIds.has(change.trace_id),
          `enhancement ${enhancement.enhanced_id} has dangling skill change`
        );
      }
      for (const [index, change] of assertArray(
        enhancement.trace_changes,
        `enhancement ${enhancement.enhanced_id} trace_changes`
      ).entries()) {
        assertExactKeys(
          change,
          ["description_after", "description_before", "trace_id"],
          `enhancement ${enhancement.enhanced_id} trace_changes[${index}]`
        );
        assert(
          allowedTraceIds.has(change.trace_id),
          `enhancement ${enhancement.enhanced_id} has dangling trace change`
        );
      }
      for (const [index, change] of assertArray(
        enhancement.rank_changes,
        `enhancement ${enhancement.enhanced_id} rank_changes`
      ).entries()) {
        assertExactKeys(
          change,
          ["description_after", "description_before", "rank_id"],
          `enhancement ${enhancement.enhanced_id} rank_changes[${index}]`
        );
        assert(
          allowedRankIds.has(change.rank_id),
          `enhancement ${enhancement.enhanced_id} has dangling rank change`
        );
      }
    }
  }

  assertUniqueIds(allBaseSkills, "all base character skills");
  assertUniqueIds(allBaseRanks, "all base character ranks");
  assertUniqueIds(allBaseTraces, "all base character traces");
  assertUniqueIds(allEnhancedSkills, "all enhanced character skills");
  assertUniqueIds(allEnhancedRanks, "all enhanced character ranks");
  assertUniqueIds(allEnhancedTraces, "all enhanced character traces");
  const allSkills = [
    ...allBaseSkills,
    ...allEnhancedSkills,
    ...servantSkillById.values(),
  ];
  const allRanks = [...allBaseRanks, ...allEnhancedRanks];
  const allTraces = [...allBaseTraces, ...allEnhancedTraces];
  assertUniqueIds(allSkills, "all character and servant skills");
  const allRankIds = assertUniqueIds(allRanks, "all character ranks");
  const allTraceIds = assertUniqueIds(allTraces, "all character traces");
  for (const skill of allSkills) {
    for (const traceId of skill.rated_trace_ids) {
      assert(
        allTraceIds.has(traceId),
        `skill ${skill.id} references unknown rated trace ${traceId}`
      );
    }
    for (const rankId of skill.rated_rank_ids) {
      assert(
        allRankIds.has(rankId),
        `skill ${skill.id} references unknown rated rank ${rankId}`
      );
    }
  }

  for (const lightCone of lightCones) {
    assertExactKeys(
      lightCone,
      [
        "background_description",
        "description",
        "effect",
        "experience_type",
        "icon_path",
        "id",
        "max_promotion",
        "max_superimposition",
        "name",
        "path_id",
        "promotions",
        "rank_up_material_ids",
        "rarity",
      ],
      `Light Cone ${lightCone.id}`
    );
    for (const materialId of assertArray(
      lightCone.rank_up_material_ids,
      `Light Cone ${lightCone.id} rank_up_material_ids`
    )) {
      assert(
        itemIds.has(materialId),
        `Light Cone ${lightCone.id} references unknown rank-up item ${materialId}`
      );
    }
    for (const [index, promotion] of assertArray(
      lightCone.promotions,
      `Light Cone ${lightCone.id} promotions`
    ).entries()) {
      assertCostReferences(
        assertObject(
          promotion,
          `Light Cone ${lightCone.id} promotions[${index}]`
        ).costs,
        itemIds,
        `Light Cone ${lightCone.id} promotions[${index}].costs`
      );
    }
    const effect = assertObject(
      lightCone.effect,
      `Light Cone ${lightCone.id} effect`
    );
    assertExactKeys(
      effect,
      ["description", "id", "name", "superimpositions"],
      `Light Cone ${lightCone.id} effect`
    );
    const superimpositions = assertArray(
      effect.superimpositions,
      `Light Cone ${lightCone.id} superimpositions`
    );
    assert(
      superimpositions.length === lightCone.max_superimposition,
      `Light Cone ${lightCone.id} superimposition count mismatch`
    );
    for (const [index, rank] of superimpositions.entries()) {
      assertExactKeys(
        rank,
        [
          "ability_name",
          "description",
          "level",
          "name",
          "parameters",
          "properties",
        ],
        `Light Cone ${lightCone.id} superimposition ${index + 1}`
      );
      assert(
        rank.level === index + 1,
        `Light Cone ${lightCone.id} superimpositions must be sequential`
      );
      assertArray(
        rank.parameters,
        `Light Cone ${lightCone.id} superimposition ${rank.level} parameters`
      );
      for (const property of assertArray(
        rank.properties,
        `Light Cone ${lightCone.id} superimposition ${rank.level} properties`
      )) {
        assertExactKeys(
          property,
          ["property_id", "value"],
          `Light Cone ${lightCone.id} superimposition ${rank.level} property`
        );
      }
    }
  }

  for (const property of propertyTables.properties) {
    assertExactKeys(
      property,
      [
        "display_order",
        "icon_path",
        "id",
        "is_battle_displayed",
        "is_displayed",
        "name",
        "relic_name",
        "usable_icon_path",
        "value_kind",
      ],
      `property ${property.id}`
    );
    assert(
      typeof property.icon_path === "string" && property.icon_path.length > 0,
      `property ${property.id} has invalid raw icon_path`
    );
    assert(
      property.usable_icon_path ===
        (property.icon_path === "0" ? null : property.icon_path),
      `property ${property.id} usable_icon_path drift`
    );
  }
}

function assertCatalogRelations(documents) {
  const characters = documents["characters.json"].value;
  const lightCones = documents["light_cones.json"].value;
  const relicSets = documents["relic_sets.json"].value;
  const relicPieces = documents["relic_pieces.json"].value;
  const propertyTables = documents["property_tables.json"].value;
  const progression = documents["progression.json"].value;
  const characterIds = assertUniqueIds(characters, "characters");
  assertUniqueIds(lightCones, "light cones");
  const relicSetIds = assertUniqueIds(relicSets, "relic sets");
  assertUniqueIds(relicPieces, "relic piece variants");
  const propertyIds = assertUniqueIds(propertyTables.properties, "properties");
  const pathIds = assertUniqueIds(propertyTables.paths, "paths");
  const combatTypeIds = assertUniqueIds(
    propertyTables.combat_types,
    "combat types"
  );
  const relicSlotIds = assertUniqueIds(
    propertyTables.relic_slots,
    "relic slots"
  );
  const relicSetById = new Map(relicSets.map((entry) => [entry.id, entry]));

  for (const character of characters) {
    assert(
      pathIds.has(character.path_id),
      `character ${character.id} has unknown Path`
    );
    assert(
      combatTypeIds.has(character.combat_type_id),
      `character ${character.id} has unknown combat type`
    );
  }
  for (const lightCone of lightCones) {
    assert(
      pathIds.has(lightCone.path_id),
      `Light Cone ${lightCone.id} has unknown Path`
    );
  }
  // Set effects can use combat-only property codes that are intentionally not
  // part of AvatarPropertyConfig's display-property catalog.
  for (const piece of relicPieces) {
    const relicSet = relicSetById.get(piece.set_id);
    assert(relicSet, `relic piece ${piece.id} has unknown set ${piece.set_id}`);
    assert(
      relicSet.kind === piece.set_kind,
      `relic piece ${piece.id} set kind mismatch`
    );
    assert(
      relicSlotIds.has(piece.slot),
      `relic piece ${piece.id} has unknown slot ${piece.slot}`
    );
  }
  for (const slot of propertyTables.relic_slots) {
    for (const propertyId of assertArray(
      slot.valid_main_properties,
      `slot ${slot.id} valid properties`
    )) {
      assert(
        propertyIds.has(propertyId),
        `slot ${slot.id} references unknown property ${propertyId}`
      );
    }
  }
  for (const list of [
    progression.relic_main_affixes,
    progression.relic_sub_affixes,
    progression.relic_scoring.main_affix_base_values,
    progression.relic_scoring.sub_affix_base_values,
  ]) {
    for (const entry of list) {
      assert(
        propertyIds.has(entry.property_id),
        `progression references unknown property ${entry.property_id}`
      );
    }
  }
  for (const list of [
    progression.relic_scoring.main_affix_character_weights,
    progression.relic_scoring.sub_affix_character_weights,
  ]) {
    for (const entry of list) {
      assert(
        entry.character_exported === characterIds.has(entry.character_id),
        `scoring character_exported drift for ${entry.character_id}`
      );
    }
  }
  assert(relicSetIds.size > 0, "relic set catalog must be non-empty");
}

function assertDiagnostics(document, schemaVersion) {
  const diagnostics = assertObject(document.value, "diagnostics.value");
  const summary = {
    resolved_deobfuscation: Object.keys(
      assertObject(
        diagnostics.resolved_deobfuscation,
        "diagnostics.resolved_deobfuscation"
      )
    ).length,
    source_disagreements: assertArray(
      diagnostics.source_disagreements,
      "diagnostics.source_disagreements"
    ).length,
    source_gaps: assertArray(diagnostics.source_gaps, "diagnostics.source_gaps")
      .length,
    unresolved_deobfuscation: assertArray(
      diagnostics.unresolved_deobfuscation,
      "diagnostics.unresolved_deobfuscation"
    ).length,
  };
  const expectedDiagnostics = EXPECTED_DIAGNOSTICS_BY_SCHEMA[schemaVersion];
  assert(
    expectedDiagnostics,
    `diagnostics has unsupported schema version ${schemaVersion}`
  );
  for (const [key, expected] of Object.entries(expectedDiagnostics)) {
    assert(
      summary[key] === expected,
      `diagnostic ${key} count mismatch: expected ${expected}; got ${summary[key]}`
    );
  }
  const blocking = diagnostics.source_disagreements.filter(
    (entry) => entry.severity === "error"
  );
  assert(
    blocking.length === 0,
    "diagnostics contain blocking source disagreements"
  );
  return summary;
}

function validateManifest(manifest) {
  const object = assertObject(manifest, "manifest");
  assertExactKeys(
    object,
    [
      "bundle_id",
      "counts",
      "files",
      "game_id",
      "locales",
      "schema_version",
      "source",
      "source_files",
    ],
    "manifest"
  );
  assert(object.bundle_id === "ggstarrail-reference", "unexpected bundle_id");
  assert(object.game_id === "honkai_star_rail", "unexpected game_id");
  const expectedCounts = assertSupportedSchema(
    object.schema_version,
    "manifest.schema_version"
  );
  assert(
    JSON.stringify(object.locales) === JSON.stringify(["en", "zh-CN"]),
    "manifest locales must be exactly en and zh-CN"
  );
  const source = assertObject(object.source, "manifest.source");
  assertExactKeys(
    source,
    [
      "branch",
      "commit_time",
      "commit_title",
      "license_status",
      "remote_url",
      "revision",
      "source_id",
      "source_version",
    ],
    "manifest.source"
  );
  assert(
    source.revision === AUDITED_SOURCE_REVISION,
    `source revision mismatch: expected ${AUDITED_SOURCE_REVISION}; got ${source.revision}`
  );
  assert(
    source.source_id === "turn_based_game_data",
    "manifest source_id must be turn_based_game_data"
  );
  assert(
    source.license_status === "no_formal_license_declared",
    "manifest must preserve the audited no-formal-license status"
  );
  assert(
    typeof source.remote_url === "string" &&
      source.remote_url ===
        "https://github.com/DimbreathBot/TurnBasedGameData.git",
    "manifest primary-source remote drifted"
  );
  assertObject(object.source_files, "manifest.source_files");
  assert(
    Object.keys(object.source_files).length > 0,
    "manifest source_files must be non-empty"
  );
  for (const [sourcePath, entry] of Object.entries(object.source_files)) {
    const sourceEntry = assertObject(
      entry,
      `manifest.source_files.${sourcePath}`
    );
    assertExactKeys(
      sourceEntry,
      ["row_count", "sha256"],
      `manifest.source_files.${sourcePath}`
    );
    assert(
      Number.isInteger(sourceEntry.row_count) && sourceEntry.row_count >= 0,
      `manifest source row count is invalid for ${sourcePath}`
    );
    assert(
      typeof sourceEntry.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(sourceEntry.sha256),
      `manifest source hash is invalid for ${sourcePath}`
    );
  }
  assertExactKeys(object.files, MEMBER_FILES, "manifest.files");
  for (const [fileName, entry] of Object.entries(object.files)) {
    assertExactKeys(
      entry,
      ["byte_count", "entity_count", "sha256"],
      `manifest.files.${fileName}`
    );
  }
  assertExactKeys(
    object.counts,
    Object.keys(expectedCounts),
    "manifest.counts"
  );
  for (const [key, expected] of Object.entries(expectedCounts)) {
    assert(
      object.counts[key] === expected,
      `audited count ${key} mismatch: expected ${expected}; got ${object.counts[key]}`
    );
  }
  return object;
}

export async function validateBundleDirectory(directory) {
  const absoluteDirectory = path.resolve(directory);
  const manifestPath = path.join(absoluteDirectory, "manifest.json");
  const manifestBytes = await readFile(manifestPath);
  const manifest = validateManifest(parseJson(manifestBytes, manifestPath));
  const documents = {};
  const bytesByFile = { "manifest.json": manifestBytes };

  for (const fileName of MEMBER_FILES) {
    const filePath = path.join(absoluteDirectory, fileName);
    const bytes = await readFile(filePath);
    const manifestEntry = assertObject(
      manifest.files[fileName],
      `manifest.files.${fileName}`
    );
    assert(
      bytes.length === manifestEntry.byte_count,
      `${fileName} byte_count mismatch: expected ${manifestEntry.byte_count}; got ${bytes.length}`
    );
    const digest = sha256(bytes);
    assert(
      digest === manifestEntry.sha256,
      `${fileName} SHA-256 mismatch: expected ${manifestEntry.sha256}; got ${digest}`
    );
    const document = assertObject(parseJson(bytes, filePath), fileName);
    assertExactKeys(
      document,
      fileName === "corroboration.json"
        ? [
            "bundle_id",
            "game_id",
            "role",
            "schema_version",
            "source_revision",
            "value",
          ]
        : [
            "bundle_id",
            "collection",
            "game_id",
            "schema_version",
            "source_revision",
            "value",
          ],
      fileName
    );
    assert(
      document.bundle_id === manifest.bundle_id,
      `${fileName} bundle_id mismatch`
    );
    assert(
      document.game_id === manifest.game_id,
      `${fileName} game_id mismatch`
    );
    assert(
      document.schema_version === manifest.schema_version,
      `${fileName} schema_version mismatch`
    );
    assert(
      document.source_revision === manifest.source.revision,
      `${fileName} source revision mismatch`
    );
    if (fileName === "corroboration.json") {
      assert(
        document.role === "validation_only_never_normalized_override",
        "corroboration role must remain validation-only"
      );
    } else {
      assert(
        document.collection === MEMBER_COLLECTIONS[fileName],
        `${fileName} collection mismatch`
      );
    }
    const entityCount = computeEntityCount(
      fileName,
      document.value,
      manifest.schema_version
    );
    assert(
      entityCount === manifestEntry.entity_count,
      `${fileName} entity_count mismatch: expected ${manifestEntry.entity_count}; got ${entityCount}`
    );
    documents[fileName] = document;
    bytesByFile[fileName] = bytes;
  }

  const expectedCounts = EXPECTED_COUNTS_BY_SCHEMA[manifest.schema_version];
  const computedCounts = computeCounts(documents, manifest.schema_version);
  for (const [key, expected] of Object.entries(expectedCounts)) {
    assert(
      computedCounts[key] === expected,
      `computed catalog count ${key} mismatch: expected ${expected}; got ${computedCounts[key]}`
    );
    assert(
      manifest.counts[key] === computedCounts[key],
      `manifest/computed count drift for ${key}`
    );
  }
  for (const fileName of [
    "characters.json",
    "light_cones.json",
    "progression.json",
    "relic_sets.json",
    "relic_pieces.json",
    "property_tables.json",
  ]) {
    assertLocalizedIdentities(
      documents[fileName].value,
      manifest.source.revision,
      fileName
    );
  }
  assertCatalogRelations(documents);
  if (manifest.schema_version === "1.0.0") {
    assertLegacyCatalogShapes(documents);
  } else {
    assertExpandedCatalogRelations(documents);
  }
  const diagnosticSummary = assertDiagnostics(
    documents["diagnostics.json"],
    manifest.schema_version
  );

  return {
    bytesByFile,
    computedCounts,
    diagnosticSummary,
    documents,
    manifest,
  };
}

const notice = `# Generated HSR reference data

Do not edit these files by hand. Run \`npm run data:sync\` from GGStarRail to
verify and copy the normalized GIlore bundle.

Primary reference values come from DimbreathBot/TurnBasedGameData at
\`${AUDITED_SOURCE_REVISION}\`, normalized by GIlore. The upstream repository
had no formal license declared at the audited revision; preserve attribution
and do not claim ownership. \`corroboration.json\` is validation-only evidence
and must never override a normalized value.
`;

export async function syncReferenceBundle(sourceDirectory, outputDirectory) {
  const source = await validateBundleDirectory(sourceDirectory);
  const absoluteOutput = path.resolve(outputDirectory);
  assert(
    absoluteOutput !== path.parse(absoluteOutput).root,
    "refusing to publish generated data at a filesystem root"
  );
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  const stagingDirectory = await mkdtemp(
    path.join(path.dirname(absoluteOutput), ".hsr-reference-sync-")
  );
  let backupParent = null;
  let previousOutput = null;
  try {
    for (const fileName of MEMBER_FILES) {
      await writeFile(
        path.join(stagingDirectory, fileName),
        source.bytesByFile[fileName]
      );
    }
    await writeFile(path.join(stagingDirectory, "README.md"), notice, "utf8");
    await writeFile(
      path.join(stagingDirectory, "manifest.json"),
      source.bytesByFile["manifest.json"]
    );
    await validateBundleDirectory(stagingDirectory);

    if (await pathExists(absoluteOutput)) {
      backupParent = await mkdtemp(
        path.join(path.dirname(absoluteOutput), ".hsr-reference-backup-")
      );
      previousOutput = path.join(backupParent, "previous");
      await rename(absoluteOutput, previousOutput);
    }
    try {
      await mkdir(absoluteOutput, { recursive: true });
      for (const fileName of MEMBER_FILES) {
        await copyFile(
          path.join(stagingDirectory, fileName),
          path.join(absoluteOutput, fileName)
        );
      }
      await copyFile(
        path.join(stagingDirectory, "README.md"),
        path.join(absoluteOutput, "README.md")
      );
      // The manifest is the commit marker and is always published last.
      await copyFile(
        path.join(stagingDirectory, "manifest.json"),
        path.join(absoluteOutput, "manifest.json")
      );
      const published = await validateBundleDirectory(absoluteOutput);
      if (backupParent) {
        await rm(backupParent, { force: true, recursive: true });
        backupParent = null;
        previousOutput = null;
      }
      return published;
    } catch (error) {
      await rm(absoluteOutput, { force: true, recursive: true });
      if (previousOutput) {
        await rename(previousOutput, absoluteOutput);
        previousOutput = null;
      }
      throw error;
    }
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true });
    if (backupParent) {
      await rm(backupParent, { force: true, recursive: true });
    }
  }
}

function parseArguments(argv) {
  const options = {
    checkGenerated: false,
    output: defaultOutputDirectory,
    source: defaultSourceDirectory,
    verifyOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source" || argument === "--output") {
      const value = argv[index + 1];
      assert(value, `${argument} requires a path`);
      options[argument.slice(2)] = path.resolve(value);
      index += 1;
    } else if (argument === "--verify-only") {
      options.verifyOnly = true;
    } else if (argument === "--check-generated") {
      options.checkGenerated = true;
    } else {
      fail(`unknown argument ${argument}`);
    }
  }
  assert(
    !(options.verifyOnly && options.checkGenerated),
    "--verify-only and --check-generated cannot be combined"
  );
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = options.checkGenerated
    ? await validateBundleDirectory(options.output)
    : options.verifyOnly
      ? await validateBundleDirectory(options.source)
      : await syncReferenceBundle(options.source, options.output);
  const operation = options.checkGenerated
    ? "Generated bundle verified"
    : options.verifyOnly
      ? "Source bundle verified"
      : "Reference bundle synchronized";
  process.stdout.write(
    `${operation}: ${result.manifest.source.revision}\n` +
      `Catalogs: ${result.computedCounts.characters} characters, ` +
      `${result.computedCounts.light_cones} Light Cones, ` +
      `${result.computedCounts.relic_sets} sets, ` +
      `${result.computedCounts.logical_relic_pieces} logical pieces / ` +
      `${result.computedCounts.relic_piece_variants} rarity variants\n` +
      `Diagnostics: ${result.diagnosticSummary.source_disagreements} disagreements, ` +
      `${result.diagnosticSummary.source_gaps} gaps, ` +
      `${result.diagnosticSummary.unresolved_deobfuscation} unresolved\n`
  );
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
