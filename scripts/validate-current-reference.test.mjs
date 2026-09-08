import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { reconstruct } from "./check-game-data.mjs";
import { validateCurrentReference } from "./validate-current-reference.mjs";

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
