import assert from "node:assert/strict";

export const currencyWarMembers = [
  "currency_war_equipment",
  "currency_war_environments",
  "currency_war_strategies",
  "currency_war_bonds",
];

export function validateCurrencyWarCatalog(catalog) {
  const ids = (rows, label) => {
    assert.ok(Array.isArray(rows), `${label} must be an array`);
    const result = new Set();
    for (const row of rows) {
      assert.match(row.id, /^\d+$/, `${label} has invalid stable ID`);
      assert.ok(!result.has(row.id), `${label} has duplicate ID ${row.id}`);
      result.add(row.id);
    }
    return result;
  };
  const collections = Object.fromEntries(
    currencyWarMembers.map((member) => {
      assert.ok(catalog[member]?.length > 0, `Empty ${member}`);
      return [member, ids(catalog[member], member)];
    })
  );
  const characters = ids(catalog.characters, "characters");
  const equipment = collections.currency_war_equipment;
  const bonds = collections.currency_war_bonds;
  const reference = (id, allowed, label) =>
    assert.ok(allowed.has(id), `${label}: missing referenced ID ${id}`);
  const numericFields = new Set([
    "parameters",
    "simple_parameters",
    "condition_parameters",
    "property_parameters",
  ]);
  const visit = (node, trail) => {
    if (Array.isArray(node)) {
      for (const [index, child] of node.entries())
        visit(child, `${trail}/${index}`);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (numericFields.has(key)) {
        assert.ok(Array.isArray(value), `${trail}/${key} must be an array`);
        assert.ok(
          value.every(
            (item) => typeof item === "number" && Number.isFinite(item)
          ),
          `${trail}/${key} must contain finite parameters`
        );
      }
      if (key === "property_id") {
        assert.equal(typeof value, "string", `${trail}/property_id`);
        assert.ok(
          node.name?.en?.value && node.name?.["zh-CN"]?.value,
          `${trail}/property name`
        );
        assert.ok(
          ["flat", "ratio", "unknown"].includes(node.value_kind),
          `${trail}/property value kind`
        );
        assert.ok(Number.isFinite(node.value), `${trail}/property value`);
      }
      if (key === "in_handbook")
        assert.equal(typeof value, "boolean", `${trail}/in_handbook`);
      if (key === "season_ids")
        assert.ok(
          Array.isArray(value) &&
            value.every((id) => Number.isInteger(id) && id > 0),
          `${trail}/season_ids`
        );
      visit(value, `${trail}/${key}`);
    }
  };
  for (const member of currencyWarMembers) visit(catalog[member], member);
  for (const row of catalog.currency_war_equipment) {
    for (const recipe of row.recipes) {
      assert.equal(
        recipe.length,
        2,
        `Equipment ${row.id} recipe must have two ingredients`
      );
      for (const id of recipe)
        reference(id, equipment, `Equipment ${row.id} recipe`);
    }
    for (const id of row.upgrade_ids)
      reference(id, equipment, `Equipment ${row.id} upgrade`);
    for (const id of row.recommended_character_ids)
      reference(id, characters, `Equipment ${row.id} character`);
  }
  for (const row of catalog.currency_war_bonds) {
    for (const id of row.character_ids)
      reference(id, characters, `Bond ${row.id} character`);
    assert.ok(row.tiers.length > 0, `Bond ${row.id} has no activation tiers`);
    assert.equal(
      new Set(row.tiers.map((tier) => tier.required_count)).size,
      row.tiers.length,
      `Bond ${row.id} has duplicate activation tiers`
    );
  }
  let roleCount = 0;
  for (const character of catalog.characters) {
    assert.ok(
      Array.isArray(character.currency_war),
      `Character ${character.id} missing Currency War`
    );
    ids(character.currency_war, `Character ${character.id} Currency War`);
    for (const role of character.currency_war) {
      roleCount++;
      assert.equal(
        role.character_id,
        character.id,
        `Currency War ${role.id} character mismatch`
      );
      assert.ok(
        ["Front", "Back", "Both"].includes(role.preferred_position),
        `Currency War ${role.id} position`
      );
      assert.ok(
        role.star_levels.length > 0,
        `Currency War ${role.id} has no star levels`
      );
      assert.equal(
        new Set(role.star_levels.map((level) => level.star)).size,
        role.star_levels.length,
        `Currency War ${role.id} has duplicate star levels`
      );
      for (const id of role.bond_ids)
        reference(id, bonds, `Currency War ${role.id} bond`);
      for (const level of role.star_levels) {
        assert.ok(
          Number.isInteger(level.star) && level.star > 0,
          `Currency War ${role.id} star`
        );
        assert.ok(
          level.front_skills.length +
            level.back_skills.length +
            level.servant_skills.length >
            0,
          `Currency War ${role.id} empty skills`
        );
      }
      visit(role, `characters/${character.id}/currency_war/${role.id}`);
    }
  }
  assert.ok(roleCount > 0, "No Currency War character adaptations");
}
