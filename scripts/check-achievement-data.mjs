import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { sha256 } from "./crawl-common.mjs";

export async function checkAchievementData(root, manifest) {
  const all = new Set();
  const counts = {};
  const released = new Map();
  let releasedGroups;
  let releasedCategoryNames;
  for (const channel of ["released", "beta"]) {
    const parts = {};
    for (const part of ["logic", "en", "zh"]) {
      const descriptor = manifest.achievementFiles[channel][part];
      const expected = `achievements${channel === "beta" ? "_beta" : ""}${part === "logic" ? "" : `_${part}`}.json${channel === "beta" ? ".gz" : ""}`;
      assert.equal(descriptor.path, expected);
      const bytes = await readFile(path.join(root, "src/data/game", expected));
      assert.equal(bytes.length, descriptor.byte_count);
      assert.equal(sha256(bytes), descriptor.sha256);
      parts[part] = JSON.parse(channel === "beta" ? gunzipSync(bytes) : bytes);
    }
    const categoryIds = new Set();
    if (channel === "released") {
      releasedGroups = parts.logic.categories.map((category) => ({
        id: category.id,
        achievements: category.achievements.map((group) =>
          group.map((entry) => entry.id)
        ),
      }));
      releasedCategoryNames = parts.zh.categories;
    }
    const ids = new Set();
    for (const category of parts.logic.categories) {
      assert.ok(!categoryIds.has(category.id));
      categoryIds.add(category.id);
      assert.deepEqual(Object.keys(category).sort(), [
        "achievements",
        "id",
        "order",
      ]);
      assert.ok(category.achievements.length);
      for (const group of category.achievements) {
        assert.ok(group.length);
        for (const entry of group) {
          assert.ok(Number.isSafeInteger(entry.id) && entry.id > 0);
          assert.ok(!all.has(entry.id), `Duplicate achievement ${entry.id}`);
          all.add(entry.id);
          ids.add(entry.id);
          assert.ok([5, 10, 20].includes(entry.reward));
          assert.deepEqual(Object.keys(entry).sort(), [
            "id",
            "order",
            "reward",
            ...(entry.version ? ["version"] : []),
          ]);
          for (const locale of ["en", "zh"]) {
            assert.equal(
              typeof parts[locale].categories[category.id],
              "string"
            );
            const text = parts[locale].achievements[entry.id];
            assert.deepEqual(Object.keys(text).sort(), ["desc", "name"]);
            assert.ok(typeof text.name === "string" && text.name.length);
            assert.ok(typeof text.desc === "string" && text.desc.length);
          }
          if (channel === "released")
            released.set(entry.id, {
              categoryId: category.id,
              name: parts.zh.achievements[entry.id].name,
            });
        }
      }
    }
    for (const locale of ["en", "zh"]) {
      assert.deepEqual(
        new Set(Object.keys(parts[locale].categories).map(Number)),
        categoryIds
      );
      assert.deepEqual(
        new Set(Object.keys(parts[locale].achievements).map(Number)),
        ids
      );
    }
    counts[channel] = { categories: categoryIds.size, achievements: ids.size };
  }
  assert.equal(
    counts.released.categories,
    manifest.reference_manifest.counts.achievement_categories
  );
  assert.equal(
    counts.released.achievements,
    manifest.reference_manifest.counts.achievements
  );
  const scanner = JSON.parse(
    await readFile(
      path.join(root, "public/good/mapping_achievements.json"),
      "utf8"
    )
  );
  assert.equal(scanner.schemaVersion, 3);
  assert.deepEqual(
    scanner.categories.map((category) => category.id),
    releasedGroups.map((category) => category.id)
  );
  const scannerEntries = new Map();
  for (const category of scanner.categories) {
    assert.equal(category.name.zh, releasedCategoryNames[category.id]);
    const expected = releasedGroups.find(
      (candidate) => candidate.id === category.id
    );
    const categoryIds = new Set();
    for (const item of category.achievements) {
      const stages = item.stages ?? [item];
      if (item.stages) {
        assert.deepEqual(Object.keys(item).sort(), ["name", "stages"]);
        assert.ok(stages.length > 1);
        assert.ok(
          expected.achievements.some(
            (group) =>
              group.length === stages.length &&
              stages.every((stage) => group.includes(stage.id))
          )
        );
      }
      for (const entry of stages) {
        assert.ok(!scannerEntries.has(entry.id));
        scannerEntries.set(entry.id, entry);
        categoryIds.add(entry.id);
        assert.deepEqual(released.get(entry.id), {
          categoryId: category.id,
          name: item.name.zh,
        });
        assert.ok(!("replaces" in entry));
        if (item.stages) {
          assert.ok(!("name" in entry));
          for (const id of [
            ...(entry.requires ?? []),
            ...(entry.requiredBy ?? []),
          ]) {
            assert.ok(
              !stages.some((stage) => stage.id === id),
              "Stage edges must not be duplicated"
            );
          }
        }
        if ("hidden" in entry) assert.equal(entry.hidden, true);
        if ("total" in entry)
          assert.ok(Number.isFinite(entry.total) && entry.total > 0);
        for (const field of ["desc", "unearnedDesc"]) {
          if (field in entry)
            assert.ok(
              typeof entry[field].zh === "string" && entry[field].zh.length
            );
        }
        if ("reward" in entry) assert.ok([5, 10, 20].includes(entry.reward));
        for (const field of ["requires", "requiredBy"]) {
          if (!(field in entry)) continue;
          assert.ok(Array.isArray(entry[field]) && entry[field].length);
          assert.equal(new Set(entry[field]).size, entry[field].length);
          for (const id of entry[field])
            assert.ok(id !== entry.id && released.has(id));
        }
      }
    }
    assert.deepEqual(categoryIds, new Set(expected.achievements.flat()));
  }
  assert.deepEqual(new Set(scannerEntries.keys()), new Set(released.keys()));
  for (const entry of scannerEntries.values()) {
    for (const id of entry.requires ?? [])
      assert.ok(scannerEntries.get(id).requiredBy?.includes(entry.id));
    for (const id of entry.requiredBy ?? [])
      assert.ok(scannerEntries.get(id).requires?.includes(entry.id));
  }
  return all;
}
