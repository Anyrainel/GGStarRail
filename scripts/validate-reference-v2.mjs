import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";

// Generated from the producer's ReferenceBundle.model_json_schema(by_alias=True).
// This strict schema owns field/type validation; the checks below own relations.
const shape = z.fromJSONSchema(
  JSON.parse(
    readFileSync(new URL("./hsr-reference-v2.schema.json", import.meta.url))
  )
);

const forbidden = new Set([
  "provenance",
  "source_table",
  "source_path",
  "source_key",
  "source_reference",
  "source_id",
  "source_url",
  "source_locale",
  "source_revision",
  "source_version",
  "promotions",
  "max_promotion",
  "experience_type",
  "character_experience",
  "light_cone_experience",
  "relic_experience",
  "unlock_costs",
  "costs",
  "level_up_costs",
  "skill_level_additions",
  "ability_names",
  "ability_name",
  "rank_up_material_ids",
  "display_description",
  "display_description_source",
  "display_parameters",
  "trigger_key",
  "anchor_type",
  "rated_trace_ids",
  "rated_rank_ids",
  "extra_effect_ids",
  "simple_extra_effect_ids",
  "attack_type",
  "effect_type",
  "player_level_required",
  "world_level_required",
  "promotion_required",
  "character_level_required",
]);

function validatePublicValues(value, trail) {
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries())
      validatePublicValues(child, `${trail}/${index}`);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert.ok(
        !forbidden.has(key),
        `Forbidden public metadata: ${trail}/${key}`
      );
      validatePublicValues(child, `${trail}/${key}`);
    }
    if ("en" in value || "zh-CN" in value) {
      for (const locale of ["en", "zh-CN"])
        assert.ok(
          typeof value[locale]?.value === "string" &&
            value[locale].value.length > 0,
          `${trail}/${locale} must contain localized text`
        );
    }
  } else if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${trail} must be finite`);
  }
}

function unique(rows, field, label) {
  const ids = new Set(rows.map((row) => row[field]));
  assert.equal(ids.size, rows.length, `${label} duplicate ${field}`);
  return ids;
}

function reference(value, allowed, label) {
  assert.ok(allowed.has(value), `${label} has unknown reference ${value}`);
}

function sequence(rows, field, first, last, label) {
  assert.ok(
    Number.isInteger(last) && last >= first,
    `${label} invalid maximum`
  );
  assert.deepEqual(
    rows.map((row) => row[field]),
    Array.from({ length: last - first + 1 }, (_, i) => i + first),
    `${label} must be sequential and complete`
  );
}

function statScaling(entity, label) {
  sequence(
    entity.stat_scaling,
    "ascension",
    0,
    entity.max_ascension,
    `${label} stat_scaling`
  );
  let previousCap = 0;
  for (const stage of entity.stat_scaling) {
    assert.ok(
      stage.max_level > previousCap,
      `${label} stat_scaling caps must increase`
    );
    previousCap = stage.max_level;
    for (const [stat, coefficients] of Object.entries(stage.stats)) {
      assert.ok(
        coefficients.base_value >= 0 && coefficients.level_add >= 0,
        `${label} stat_scaling ${stat} must be nonnegative`
      );
    }
  }
}

function skills(rows, label) {
  unique(rows, "id", label);
  for (const row of rows) {
    assert.ok(
      row.normal_max_level >= 1 && row.normal_max_level <= row.max_level,
      `${label} skill ${row.id} has invalid normal level cap`
    );
    sequence(row.levels, "level", 1, row.max_level, `${label} skill ${row.id}`);
  }
}

function traceStats(rows, propertyIds, label) {
  unique(rows, "property_id", `${label} trace stats`);
  for (const row of rows)
    reference(row.property_id, propertyIds, `${label} trace stat property`);
}

function ranks(rows, maxRank, label) {
  unique(rows, "id", label);
  sequence(rows, "rank", 1, maxRank, label);
}

function traces(rows, propertyIds, label) {
  const ids = unique(rows, "id", label);
  for (const row of rows) {
    sequence(row.levels, "level", 1, row.max_level, `${label} trace ${row.id}`);
    for (const id of row.prerequisite_ids)
      reference(id, ids, `${label} trace prerequisite`);
    for (const level of row.levels)
      for (const property of level.properties)
        reference(property.property_id, propertyIds, `${label} trace property`);
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const complete = new Set();
  const visit = (id, active) => {
    assert.ok(!active.has(id), `${label} trace prerequisite cycle`);
    if (complete.has(id)) return;
    active.add(id);
    for (const previous of byId.get(id).prerequisite_ids)
      visit(previous, active);
    active.delete(id);
    complete.add(id);
  };
  for (const id of ids) visit(id, new Set());
}

function achievements(catalog) {
  const categories = new Map(
    catalog.achievement_categories.map((row) => [row.id, row])
  );
  const entries = new Map(catalog.achievements.map((row) => [row.id, row]));
  const used = new Set();
  const rewards = { Low: 5, Mid: 10, High: 20 };
  const icons = {
    Low: "copper_icon_path",
    Mid: "silver_icon_path",
    High: "gold_icon_path",
  };
  assert.deepEqual(
    catalog.achievement_categories.map((row) => row.id),
    [...categories.values()]
      .sort((a, b) => b.order - a.order || a.id - b.id)
      .map((row) => row.id),
    "Achievement category display order"
  );
  const order = new Map(
    catalog.achievement_categories.map((row, index) => [row.id, index])
  );
  assert.deepEqual(
    catalog.achievements.map((row) => row.id),
    [...entries.values()]
      .sort(
        (a, b) =>
          order.get(a.category_id) - order.get(b.category_id) ||
          b.order - a.order ||
          a.id - b.id
      )
      .map((row) => row.id),
    "Achievement display order"
  );
  for (const entry of entries.values()) {
    reference(
      entry.category_id,
      new Set(categories.keys()),
      `Achievement ${entry.id} category`
    );
    used.add(entry.category_id);
    assert.equal(
      entry.reward.count,
      rewards[entry.rarity],
      `Achievement ${entry.id} reward`
    );
    assert.equal(
      entry.icon_path,
      categories.get(entry.category_id)[icons[entry.rarity]],
      `Achievement ${entry.id} icon`
    );
    if (entry.visibility === "hidden_description")
      assert.ok(
        entry.hidden_description,
        `Achievement ${entry.id} hidden description`
      );
    assert.equal(
      entry.record_text === null,
      entry.record_type === null,
      `Achievement ${entry.id} record metadata`
    );
    assert.ok(
      entry.chain_ids.length > 0 &&
        new Set(entry.chain_ids).size === entry.chain_ids.length,
      `Achievement ${entry.id} chain IDs`
    );
    assert.equal(
      entry.chain_ids[entry.chain_index],
      entry.id,
      `Achievement ${entry.id} chain index`
    );
    assert.equal(
      entry.previous_id,
      entry.chain_index ? entry.chain_ids[entry.chain_index - 1] : null,
      `Achievement ${entry.id} previous ID`
    );
    assert.deepEqual(
      entry.next_ids,
      entry.chain_ids.slice(entry.chain_index + 1, entry.chain_index + 2),
      `Achievement ${entry.id} next IDs`
    );
    for (const id of entry.chain_ids) {
      const peer = entries.get(id);
      assert.ok(peer, `Achievement ${entry.id} unknown chain ID ${id}`);
      assert.equal(
        peer.linear_quest_id,
        entry.linear_quest_id,
        `Achievement ${entry.id} linear quest`
      );
      assert.deepEqual(
        peer.chain_ids,
        entry.chain_ids,
        `Achievement ${entry.id} inconsistent chain`
      );
    }
  }
  assert.equal(
    used.size,
    categories.size,
    "Every achievement category must be used"
  );
}

export function validateReferenceV2(
  catalog,
  schemaVersion,
  { separateAchievements = false } = {}
) {
  assert.equal(schemaVersion, "2.0.0", "Unsupported current reference schema");
  validatePublicValues(catalog, "catalog");
  const selectedShape = separateAchievements
    ? shape.omit({ achievements: true, achievement_categories: true })
    : shape;
  const parsed = selectedShape.safeParse(catalog);
  assert.ok(
    parsed.success,
    parsed.success
      ? ""
      : `Invalid reference v2 contract: ${parsed.error.message}`
  );
  for (const [name, rows] of Object.entries(catalog)) {
    if (!Array.isArray(rows)) continue;
    assert.ok(rows.length, `Empty ${name}`);
    unique(rows, "id", name);
  }
  const properties = catalog.property_tables;
  const propertyIds = unique(properties.properties, "id", "properties");
  const pathIds = unique(properties.paths, "id", "paths");
  const combatTypes = unique(properties.combat_types, "id", "combat types");
  const slots = unique(properties.relic_slots, "id", "slots");
  const characters = new Set(catalog.characters.map((row) => row.id));
  const servants = new Map();
  const allSkills = [],
    allRanks = [],
    allTraces = [];
  for (const character of catalog.characters) {
    const label = `Character ${character.id}`;
    reference(character.path_id, pathIds, `${label} Path`);
    reference(character.combat_type_id, combatTypes, `${label} combat type`);
    statScaling(character, label);
    skills(character.skills, label);
    ranks(character.ranks, character.max_rank, label);
    traces(character.traces, propertyIds, label);
    traceStats(character.trace_stats, propertyIds, label);
    allSkills.push(...character.skills);
    allRanks.push(...character.ranks);
    allTraces.push(...character.traces);
    unique(character.servants, "id", `${label} servants`);
    for (const servant of character.servants) {
      skills(servant.skills, `Servant ${servant.id}`);
      if (servants.has(servant.id))
        assert.deepEqual(
          servant,
          servants.get(servant.id),
          `Servant ${servant.id} attachment drift`
        );
      servants.set(servant.id, servant);
    }
    unique(character.enhancements, "enhanced_id", `${label} enhancements`);
    for (const variant of character.enhancements) {
      const variantLabel = `${label} enhancement ${variant.enhanced_id}`;
      skills(variant.skills, variantLabel);
      ranks(variant.ranks, character.max_rank, variantLabel);
      traces(variant.traces, propertyIds, variantLabel);
      traceStats(variant.trace_stats, propertyIds, variantLabel);
      allSkills.push(...variant.skills);
      allRanks.push(...variant.ranks);
      allTraces.push(...variant.traces);
      const skillIds = new Set(
        [...character.skills, ...variant.skills].map((row) => row.id)
      );
      const rankIds = new Set(
        [...character.ranks, ...variant.ranks].map((row) => row.id)
      );
      const traceIds = new Set(
        [...character.traces, ...variant.traces].map((row) => row.id)
      );
      for (const change of variant.skill_changes) {
        reference(change.skill_id, skillIds, `${variantLabel} skill change`);
        reference(change.trace_id, traceIds, `${variantLabel} skill trace`);
      }
      for (const change of variant.trace_changes)
        reference(change.trace_id, traceIds, `${variantLabel} trace change`);
      for (const change of variant.rank_changes)
        reference(change.rank_id, rankIds, `${variantLabel} rank change`);
    }
  }
  unique(
    [...allSkills, ...[...servants.values()].flatMap((row) => row.skills)],
    "id",
    "all skills"
  );
  unique(allRanks, "id", "all ranks");
  unique(allTraces, "id", "all traces");
  for (const cone of catalog.light_cones) {
    reference(cone.path_id, pathIds, `Light Cone ${cone.id} Path`);
    statScaling(cone, `Light Cone ${cone.id}`);
    sequence(
      cone.effect.superimpositions,
      "level",
      1,
      cone.max_superimposition,
      `Light Cone ${cone.id} superimpositions`
    );
  }
  const sets = new Map(catalog.relic_sets.map((row) => [row.id, row]));
  for (const piece of catalog.relic_pieces) {
    assert.ok(sets.has(piece.set_id), `Relic ${piece.id} unknown set`);
    assert.equal(
      piece.set_kind,
      sets.get(piece.set_id).kind,
      `Relic ${piece.id} set kind`
    );
    reference(piece.slot, slots, `Relic ${piece.id} slot`);
    assert.equal(
      ["NECK", "OBJECT"].includes(piece.slot),
      piece.set_kind === "planar_ornament",
      `Relic ${piece.id} planar slot`
    );
  }
  for (const row of properties.properties) {
    assert.equal(
      row.usable_icon_path,
      ["", "0"].includes(row.icon_path) ? null : row.icon_path,
      `Property ${row.id} usable icon`
    );
  }
  for (const slot of properties.relic_slots)
    for (const id of slot.valid_main_properties)
      reference(id, propertyIds, `Slot ${slot.id} property`);
  const progression = catalog.progression;
  const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, label);
  for (const [key, rows] of Object.entries(progression)) {
    if (key === "relic_scoring") continue;
    assert.ok(rows.length, `Empty progression ${key}`);
    assert.equal(
      new Set(rows.map((row) => `${row.group_id}/${row.affix_id}`)).size,
      rows.length,
      `Duplicate ${key} identity`
    );
    for (const row of rows)
      reference(row.property_id, propertyIds, `${key} property`);
  }
  for (const row of progression.relic_main_affixes) {
    assert.equal(
      row.level_values.length,
      row.max_level + 1,
      "Main affix level count"
    );
    row.level_values.forEach((value, level) => {
      near(value, row.base_value + row.level_add * level, "Main affix formula");
    });
  }
  for (const row of progression.relic_sub_affixes) {
    assert.equal(
      row.roll_values.length,
      row.step_count + 1,
      "Sub affix roll count"
    );
    row.roll_values.forEach((value, step) => {
      near(value, row.base_value + row.step_value * step, "Sub affix formula");
    });
  }
  for (const piece of catalog.relic_pieces) {
    const main = progression.relic_main_affixes.filter(
      (row) => row.group_id === piece.main_affix_group
    );
    assert.ok(
      main.length && main.every((row) => row.max_level === piece.max_level),
      `Relic ${piece.id} main affix group`
    );
    assert.ok(
      progression.relic_sub_affixes.some(
        (row) => row.group_id === piece.sub_affix_group
      ),
      `Relic ${piece.id} sub affix group`
    );
  }
  for (const [key, rows] of Object.entries(progression.relic_scoring)) {
    assert.ok(rows.length, `Empty scoring ${key}`);
    const weights = key.endsWith("character_weights");
    unique(rows, weights ? "character_id" : "property_id", key);
    for (const row of rows) {
      if (weights)
        assert.equal(
          row.character_exported,
          characters.has(row.character_id),
          `Scoring character_exported ${row.character_id}`
        );
      else reference(row.property_id, propertyIds, `${key} property`);
    }
  }
  if (!separateAchievements) achievements(catalog);
}
