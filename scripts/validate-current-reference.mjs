import assert from "node:assert/strict";
import { validateReferenceCatalog } from "./sync-hsr-reference.mjs";

// Reassemble the complete source catalog before checking joins. Enhanced
// characters occur in both channels; the beta copy retains their enhancements.
export function mergeCatalog(documents) {
  const merge = (left, right, trail) => {
    if (Array.isArray(left)) {
      const rows = new Map(left.map((row) => [row.id, row]));
      if ([...left, ...right].some((row) => row.id === undefined)) {
        // Progression tables have composite keys, checked by the domain
        // validator; character scoring weights can span both channels.
        return [...left, ...right];
      }
      assert.equal(rows.size, left.length, `Duplicate IDs: ${trail}`);
      const betaIds = new Set();
      for (const row of right) {
        assert.ok(
          !betaIds.has(row.id),
          `Duplicate beta ID: ${trail}/${row.id}`
        );
        betaIds.add(row.id);
        if (rows.has(row.id)) {
          assert.equal(trail, "characters", `Overlapping catalog: ${trail}`);
          assert.deepEqual(
            { ...rows.get(row.id), enhancements: [] },
            { ...row, enhancements: [] },
            `Conflicting character channels: ${row.id}`
          );
        }
        rows.set(row.id, row);
      }
      return [...rows.values()];
    }
    return Object.fromEntries(
      Object.entries(left).map(([key, value]) => [
        key,
        right[key] === undefined
          ? value
          : merge(value, right[key], `${trail}.${key}`),
      ])
    );
  };
  return Object.fromEntries(
    Object.entries(documents)
      .filter(([key]) => !key.startsWith("nanoka_"))
      .map(([key, value]) => [key, merge(value.released, value.beta, key)])
  );
}

export function validateCurrentReference(documents, capture, manifest) {
  const catalog = mergeCatalog(documents);
  // Splitting released/beta records changes their interleaving, so restore the
  // source display order before applying the full catalog validator.
  const categoryOrder = new Map(
    catalog.achievement_categories.map((row, index) => [row.id, index])
  );
  catalog.achievements.sort(
    (a, b) =>
      categoryOrder.get(a.category_id) - categoryOrder.get(b.category_id) ||
      b.order - a.order ||
      Number(a.id) - Number(b.id)
  );
  validateReferenceCatalog(
    Object.fromEntries(
      Object.entries(catalog).map(([key, value]) => [`${key}.json`, { value }])
    ),
    manifest.reference_manifest.schema_version,
    manifest.source_revision
  );
  const name = (text) => ({ en: text.en.value, zhCn: text["zh-CN"].value });
  const compare = (actual, expected, label) => {
    const stable = (value) =>
      Array.isArray(value)
        ? value.map(stable)
        : value !== null && typeof value === "object"
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, stable(value[key])])
            )
          : value;
    const sort = (rows) =>
      rows
        .map(stable)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    assert.deepEqual(
      sort(actual),
      sort(expected),
      `Capture field mismatch: ${label}`
    );
  };
  for (const [member, field] of [
    ["characters", "characters"],
    ["light_cones", "lightCones"],
  ])
    compare(
      capture.snapshot[field],
      catalog[member].map((row) => ({
        gameId: Number(row.id),
        key: row.id,
        name: name(row.name),
        rarity: row.rarity,
        path: row.path_id,
      })),
      field
    );
  const sets = new Map(catalog.relic_sets.map((row) => [row.id, row]));
  const slots = {
    HEAD: "Head",
    HAND: "Hands",
    BODY: "Body",
    FOOT: "Feet",
    NECK: "PlanarSphere",
    OBJECT: "LinkRope",
  };
  compare(
    capture.snapshot.gearPieces,
    catalog.relic_pieces.map((row) => ({
      gameId: Number(row.id),
      key: row.id,
      name: name(row.name),
      iconPath: row.icon_path,
      setKey: row.set_id,
      setName: name(sets.get(row.set_id).name),
      rarity: row.rarity,
      category: ["NECK", "OBJECT"].includes(row.slot)
        ? "planarOrnament"
        : "relic",
      slot: slots[row.slot],
      mainAffixGroup: row.main_affix_group,
      maxLevel: row.max_level,
    })),
    "gearPieces"
  );
  compare(
    capture.snapshot.stats,
    catalog.property_tables.properties
      .filter((row) => row.relic_name !== null)
      .map((row) => ({
        key: row.id,
        name: name(row.relic_name),
        valueKind: row.value_kind,
      })),
    "stats"
  );
  compare(
    capture.snapshot.relicMainAffixes,
    catalog.progression.relic_main_affixes.map((row) => ({
      groupId: row.group_id,
      propertyId: row.property_id,
      maxLevel: row.max_level,
      levelValues: row.level_values,
    })),
    "relicMainAffixes"
  );
  compare(
    capture.packet.main,
    catalog.progression.relic_main_affixes.map((row) => ({
      group: row.group_id,
      id: row.affix_id,
      property: row.property_id,
    })),
    "packet.main"
  );
  compare(
    capture.packet.sub,
    catalog.progression.relic_sub_affixes.map((row) => ({
      group: row.group_id,
      id: row.affix_id,
      property: row.property_id,
      base: row.base_value,
      step: row.step_value,
    })),
    "packet.sub"
  );
}
