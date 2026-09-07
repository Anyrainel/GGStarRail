import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  crawlRoot,
  fetchBytes,
  mapConcurrent,
  root,
  saveJson,
  sha256,
  webpAsset,
} from "./crawl-common.mjs";

const host = "https://static.nanoka.cc";
const collections = {
  characters: "character",
  light_cones: "lightcone",
  relic_sets: "relicset",
};

export function nanokaVersion(value) {
  const version = value?.hsr?.latest;
  if (typeof version !== "string" || !/^\d+(?:\.\d+){1,3}$/.test(version))
    throw new Error("Nanoka manifest has no valid HSR latest version");
  if (!value.hsr.available?.includes(version))
    throw new Error("Nanoka latest version is absent from available versions");
  return version;
}

export async function crawlNanoka({
  evidencePath = path.join(crawlRoot, "hoyolab.json"),
  outputRoot = path.join(crawlRoot, "nanoka"),
  images = true,
} = {}) {
  const manifestBytes = await fetchBytes(`${host}/manifest.json`);
  const manifest = JSON.parse(manifestBytes);
  const version = nanokaVersion(manifest);
  const official = JSON.parse(await readFile(evidencePath, "utf8"));
  const released = new Set(
    official.entries
      .filter((entry) => entry.beta === false && entry.status === "Online")
      .map((entry) => `${entry.collection}:${entry.id}`)
  );
  const entries = [];
  const versionRoot = path.join(outputRoot, version);
  for (const [collection, resource] of Object.entries(collections)) {
    const url = `${host}/hsr/${version}/${resource}.json`;
    const bytes = await fetchBytes(url);
    const index = JSON.parse(bytes);
    if (!index || Array.isArray(index) || Object.keys(index).length === 0)
      throw new Error(`Nanoka ${resource} index is empty or malformed`);
    await mkdir(versionRoot, { recursive: true });
    await writeFile(path.join(versionRoot, `${resource}.json`), bytes);
    const unknown = Object.entries(index).filter(
      ([id]) => !released.has(`${collection}:${id}`)
    );
    const found = await mapConcurrent(unknown, async ([id, record]) => {
      if (
        !/^\d+$/.test(id) ||
        typeof record.en !== "string" ||
        typeof record.zh !== "string"
      )
        throw new Error(
          `Nanoka ${resource}:${id} lacks a stable ID or bilingual names`
        );
      const entry = {
        collection,
        id,
        source: "nanoka",
        version,
        status: "beta-or-unknown",
        index_url: url,
        index_sha256: sha256(bytes),
        details: {},
      };
      // Relic set indexes themselves contain bilingual bonuses; character/light-cone
      // detail tables are language-specific and retained intact for GIlore normalization.
      if (collection !== "relic_sets") {
        for (const locale of ["en", "zh"]) {
          const detailUrl = `${host}/hsr/${version}/${locale}/${resource}/${id}.json`;
          const detailBytes = await fetchBytes(detailUrl);
          const detail = JSON.parse(detailBytes);
          if (!detail || typeof detail !== "object" || Array.isArray(detail))
            throw new Error(`Nanoka malformed detail: ${detailUrl}`);
          const filename = `${locale}/${resource}/${id}.json`;
          const target = path.join(versionRoot, filename);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, detailBytes);
          entry.details[locale] = {
            path: filename,
            url: detailUrl,
            sha256: sha256(detailBytes),
          };
        }
      }
      if (images) {
        const imagePath =
          collection === "characters"
            ? `avatarshopicon/${id}.webp`
            : collection === "light_cones"
              ? `lightconemediumicon/${id}.webp`
              : `itemfigures/${path.posix.basename(record.icon).replace(/\.png$/i, ".webp")}`;
        entry.asset = await webpAsset(`${host}/assets/hsr/${imagePath}`);
      }
      return entry;
    });
    entries.push(...found);
    console.log(
      `Nanoka ${version} ${collection}: ${found.length} beta/unknown records crawled`
    );
  }
  const result = {
    schema_version: "1.0.0",
    version,
    source_revision: official.source_revision,
    manifest_sha256: sha256(manifestBytes),
    entries,
  };
  await saveJson(path.join(versionRoot, "manifest.json"), result);
  await saveJson(path.join(outputRoot, "latest.json"), result);
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (args.includes("--help"))
    console.log("node scripts/nanoka.mjs [--no-images] [--output-root DIR]");
  else {
    const index = args.indexOf("--output-root");
    await crawlNanoka({
      images: !args.includes("--no-images"),
      ...(index >= 0
        ? { outputRoot: path.resolve(root, args[index + 1]) }
        : {}),
    });
  }
}
