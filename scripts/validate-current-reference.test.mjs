import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { reconstruct } from "./check-game-data.mjs";
import {
  mergeCatalog,
  validateCurrentReference,
} from "./validate-current-reference.mjs";
import { validateReferenceV2 } from "./validate-reference-v2.mjs";

const game = new URL("../src/data/game/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", game)));
const documents = {};
for (const [member, channels] of Object.entries(manifest.members)) {
  documents[member] = {};
  for (const [channel, parts] of Object.entries(channels)) {
    const values = {};
    for (const [part, descriptor] of Object.entries(parts)) {
      const bytes = await readFile(new URL(descriptor.path, game));
      values[part] = JSON.parse(
        descriptor.path.endsWith(".gz") ? gunzipSync(bytes) : bytes
      );
    }
    documents[member][channel] = reconstruct(
      values.stats,
      values.en,
      values.zh,
      manifest.source_revision
    ).value;
  }
}
const capture = JSON.parse(
  await readFile(new URL("../public/good/hsr_data_cache.json", import.meta.url))
);

test("current published catalog and capture values agree", () => {
  validateCurrentReference(documents, capture, manifest);
  assert.ok(capture.snapshot.characters.some((row) => row.gameId === 1508));
});

for (const [label, mutate] of [
  [
    "character path",
    (data) => {
      data.snapshot.characters[0].path = "wrong";
    },
  ],
  [
    "Light Cone rarity",
    (data) => {
      data.snapshot.lightCones[0].rarity = 1;
    },
  ],
  [
    "Relic set name",
    (data) => {
      data.snapshot.gearPieces[0].setName.en = "wrong";
    },
  ],
  [
    "main stat progression",
    (data) => {
      data.snapshot.relicMainAffixes[0].levelValues[0] += 1;
    },
  ],
  [
    "substat roll",
    (data) => {
      data.packet.sub[0].step += 1;
    },
  ],
]) {
  test(`rejects unchanged IDs with corrupted ${label}`, () => {
    const changed = structuredClone(capture);
    mutate(changed);
    assert.throws(
      () => validateCurrentReference(documents, changed, manifest),
      /Capture field mismatch/
    );
  });
}

test("rejects broken achievement category relationships", () => {
  const changed = structuredClone(documents);
  changed.achievements.released[0].category_id = "missing";
  assert.throws(
    () => validateCurrentReference(changed, capture, manifest),
    /category/
  );
});

for (const [label, mutate, expected] of [
  [
    "recipe ingredient",
    (data) => {
      data.currency_war_equipment.released.find(
        (row) => row.recipes.length
      ).recipes[0][0] = "999999999";
    },
    /recipe.*missing referenced ID/,
  ],
  [
    "character bond",
    (data) => {
      data.characters.released.find(
        (row) => row.currency_war.length
      ).currency_war[0].bond_ids[0] = "999999999";
    },
    /bond|Conflicting character.*channels/,
  ],
  [
    "effect parameter",
    (data) => {
      data.currency_war_strategies.released[0].parameters = [null];
    },
    /parameters/,
  ],
  [
    "empty environment catalog",
    (data) => {
      data.currency_war_environments = { released: [], beta: [] };
    },
    /Empty currency_war_environments/,
  ],
]) {
  test(`rejects Currency War ${label} corruption`, () => {
    const changed = structuredClone(documents);
    mutate(changed);
    assert.throws(
      () => validateCurrentReference(changed, capture, manifest),
      expected
    );
  });
}

for (const [label, mutate, expected] of [
  [
    "text provenance",
    (data) => {
      data.characters[0].name.en.provenance = { source_key: "123" };
    },
    /Forbidden public metadata.*provenance/,
  ],
  [
    "source table",
    (data) => {
      data.characters[0].skills[0].source_table = "AvatarSkillConfig";
    },
    /Forbidden public metadata.*source_table/,
  ],
  [
    "Eidolon unlock costs",
    (data) => {
      data.characters[0].ranks[0].unlock_costs = [];
    },
    /Forbidden public metadata.*unlock_costs/,
  ],
  [
    "EXP catalog",
    (data) => {
      data.progression.character_experience = [];
    },
    /Forbidden public metadata.*character_experience/,
  ],
  [
    "unknown nested field",
    (data) => {
      data.light_cones[0].effect.unexpected = true;
    },
    /unrecognized_keys/,
  ],
  [
    "missing skill description",
    (data) => {
      delete data.characters[0].skills[0].description;
    },
    /description/,
  ],
  [
    "missing Chinese text",
    (data) => {
      delete data.characters[0].name["zh-CN"];
    },
    /localized text/,
  ],
  [
    "invalid stat coefficients",
    (data) => {
      data.light_cones[0].stat_scaling[0].stats.hp.base_value = -1;
    },
    /stat_scaling.*nonnegative/,
  ],
  [
    "missing ascension",
    (data) => {
      data.characters[0].stat_scaling.pop();
    },
    /stat_scaling.*sequential/,
  ],
  [
    "skill level gap",
    (data) => {
      data.characters[0].skills[0].levels.pop();
    },
    /skill.*sequential/,
  ],
  [
    "trace prerequisite cycle",
    (data) => {
      const trace = data.characters[0].traces[0];
      trace.prerequisite_ids = [trace.id];
    },
    /prerequisite cycle/,
  ],
  [
    "broken enhancement change",
    (data) => {
      data.characters.find(
        (row) => row.enhancements.length
      ).enhancements[0].skill_changes[0].skill_id = "missing";
    },
    /skill change.*unknown reference/,
  ],
  [
    "broken relic group",
    (data) => {
      data.relic_pieces[0].main_affix_group = 999999;
    },
    /main affix group/,
  ],
  [
    "main-affix formula drift",
    (data) => {
      data.progression.relic_main_affixes[0].level_values[0] += 1;
    },
    /Main affix formula/,
  ],
  [
    "sub-affix formula drift",
    (data) => {
      data.progression.relic_sub_affixes[0].roll_values[0] += 1;
    },
    /Sub affix formula/,
  ],
  [
    "scoring join drift",
    (data) => {
      data.progression.relic_scoring.main_affix_character_weights[0].character_exported = false;
    },
    /Scoring character_exported/,
  ],
  [
    "achievement chain drift",
    (data) => {
      data.achievements[0].chain_index = 99;
    },
    /chain index/,
  ],
]) {
  test(`v2 rejects ${label}`, () => {
    const catalog = mergeCatalog(structuredClone(documents));
    const order = new Map(
      catalog.achievement_categories.map((row, index) => [row.id, index])
    );
    catalog.achievements.sort(
      (a, b) =>
        order.get(a.category_id) - order.get(b.category_id) ||
        b.order - a.order ||
        a.id - b.id
    );
    mutate(catalog);
    assert.throws(() => validateReferenceV2(catalog, "2.0.0"), expected);
  });
}

test("current validator refuses legacy schema versions", () => {
  assert.throws(
    () => validateReferenceV2(mergeCatalog(documents), "1.3.0"),
    /Unsupported current reference schema/
  );
});
