import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { root, sha256 } from "./crawl-common.mjs";

const baseMembers = [
  "characters",
  "light_cones",
  "relic_sets",
  "relic_pieces",
  "achievement_categories",
  "achievements",
  "progression",
  "property_tables",
];
const previewMembers = [
  "nanoka_characters",
  "nanoka_light_cones",
  "nanoka_relic_sets",
];

export function reconstruct(stats, en, zh, revision) {
  const pointers = new Set();
  const hydrate = (value) => {
    if (Array.isArray(value)) return value.map(hydrate);
    if (value === null || typeof value !== "object") return value;
    if (Object.hasOwn(value, "$text")) {
      assert.deepEqual(
        Object.keys(value),
        ["$text"],
        "Text marker must have exactly one key"
      );
      const pointer = value.$text;
      assert.equal(typeof pointer, "string");
      assert.ok(
        pointer.startsWith("/value/"),
        `Invalid text pointer ${pointer}`
      );
      let target = stats;
      for (const token of pointer.slice(1).split("/"))
        target = target?.[token.replace(/~1/g, "/").replace(/~0/g, "~")];
      assert.deepEqual(
        target,
        value,
        `Text pointer does not identify its marker: ${pointer}`
      );
      pointers.add(pointer);
      for (const [locale, map] of [
        ["en", en],
        ["zh-CN", zh],
      ]) {
        assert.ok(
          Object.hasOwn(map, pointer),
          `Missing ${locale} text ${pointer}`
        );
        assert.equal(typeof map[pointer].value, "string");
        assert.equal(map[pointer].provenance.locale, locale);
        assert.ok(
          map[pointer].provenance.source_revision,
          "Missing source text revision"
        );
        if (map[pointer].provenance.source_id === "turn_based_game_data")
          assert.equal(
            map[pointer].provenance.source_revision,
            "$source_revision",
            "Datamine text revision must use the manifest token"
          );
      }
      return { en: hydrate(en[pointer]), "zh-CN": hydrate(zh[pointer]) };
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        if (key === "source_revision" && child === "$source_revision")
          return [key, revision];
        return [key, hydrate(child)];
      })
    );
  };
  const result = hydrate(stats);
  assert.deepEqual(
    Object.keys(en).sort(),
    [...pointers].sort(),
    "Unused English locale entries"
  );
  assert.deepEqual(
    Object.keys(zh).sort(),
    [...pointers].sort(),
    "Unused Chinese locale entries"
  );
  return result;
}

export async function checkGameData(repositoryRoot = root) {
  const gameRoot = path.join(repositoryRoot, "src/data/game");
  const manifest = JSON.parse(
    await readFile(path.join(gameRoot, "manifest.json"), "utf8")
  );
  assert.equal(manifest.schema_version, "1.0.0");
  assert.match(manifest.source_revision, /^[a-f0-9]{40}$/);
  assert.equal(
    manifest.reference_manifest.source.revision,
    manifest.source_revision
  );
  assert.equal(manifest.reference_manifest.schema_version, "1.2.0");
  assert.equal(Object.hasOwn(manifest.reference_manifest, "files"), false);
  assert.deepEqual(
    Object.keys(manifest.members).sort(),
    [...baseMembers, ...previewMembers].sort()
  );
  const sourceAssets = JSON.parse(
    await readFile(
      path.join(repositoryRoot, "data/source-assets/manifest.json"),
      "utf8"
    )
  );
  assert.equal(sourceAssets.schema_version, "1.0.0");
  assert.equal(sourceAssets.source_revision, manifest.source_revision);
  const assetPaths = new Set();
  for (const asset of sourceAssets.entries) {
    assert.match(asset.path, /^webp\/[a-f0-9]{64}\.webp$/);
    assert.equal(path.basename(asset.path, ".webp"), asset.sha256);
    const bytes = await readFile(
      path.join(repositoryRoot, "data/source-assets", asset.path)
    );
    assert.equal(bytes.length, asset.byte_count);
    assert.equal(sha256(bytes), asset.sha256);
    assetPaths.add(`/assets/ggstarrail/${asset.path}`);
  }
  const documents = {};
  let totalBytes = 0;
  for (const [member, channels] of Object.entries(manifest.members)) {
    documents[member] = {};
    for (const channel of ["released", "beta"]) {
      assert.deepEqual(Object.keys(channels[channel]).sort(), [
        "en",
        "stats",
        "zh",
      ]);
      const values = {};
      for (const part of ["stats", "en", "zh"]) {
        const descriptor = channels[channel][part];
        const expected = `${member}_${channel === "beta" ? "beta_" : ""}${part}.json${channel === "beta" ? ".gz" : ""}`;
        assert.equal(descriptor.path, expected, "Unexpected transport path");
        assert.match(descriptor.sha256, /^[a-f0-9]{64}$/);
        const bytes = await readFile(path.join(gameRoot, expected));
        assert.equal(
          bytes.length,
          descriptor.byte_count,
          `Size mismatch: ${expected}`
        );
        assert.equal(
          sha256(bytes),
          descriptor.sha256,
          `Checksum mismatch: ${expected}`
        );
        totalBytes += bytes.length;
        if (channel === "beta")
          assert.deepEqual(
            [...bytes.subarray(4, 8)],
            [0, 0, 0, 0],
            "Beta gzip timestamp must be deterministic"
          );
        values[part] = JSON.parse(
          channel === "beta" ? gunzipSync(bytes) : bytes
        );
      }
      assert.equal(values.stats.source_revision, "$source_revision");
      assert.equal(values.stats.collection, member);
      assert.equal(values.stats.game_id, "honkai_star_rail");
      assert.equal(values.stats.schema_version, "1.2.0");
      const document = reconstruct(
        values.stats,
        values.en,
        values.zh,
        manifest.source_revision
      );
      assert.equal(document.source_revision, manifest.source_revision);
      documents[member][channel] = document.value;
      if (Array.isArray(document.value)) {
        assert.equal(
          new Set(document.value.map((record) => record.id)).size,
          document.value.length,
          `Duplicate ${member}/${channel} IDs`
        );
        if (member.startsWith("nanoka_")) {
          if (channel === "released") assert.equal(document.value.length, 0);
          for (const preview of document.value) {
            assert.ok(
              assetPaths.has(preview.image_path),
              `Preview image absent from tracked assets: ${member}:${preview.id}`
            );
            assert.equal(preview.name.en.provenance.source_id, "nanoka");
            assert.ok(
              preview.sections.length > 0,
              `Empty source preview ${member}:${preview.id}`
            );
          }
        }
      }
    }
  }
  for (const key of [
    "characters",
    "light_cones",
    "relic_sets",
    "achievements",
    "achievement_categories",
  ])
    assert.equal(
      documents[key].released.length,
      manifest.reference_manifest.counts[key],
      `Released count mismatch: ${key}`
    );
  for (const [key, value] of Object.entries(manifest.reference_manifest.counts))
    assert.ok(
      Number.isSafeInteger(value) && value >= 0,
      `Invalid released count ${key}`
    );
  for (const member of previewMembers) {
    const base = documents[member.slice("nanoka_".length)];
    const known = new Set(
      [...base.released, ...base.beta].map((record) => record.id)
    );
    for (const preview of documents[member].beta)
      assert.equal(
        known.has(preview.id),
        false,
        `Preview duplicates complete data: ${preview.id}`
      );
  }
  console.log(
    `Website data verified: ${Object.keys(documents).length} members, ${totalBytes} transport bytes, ${assetPaths.size} source WebPs`
  );
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await checkGameData();
