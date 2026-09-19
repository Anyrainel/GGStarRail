import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  mapConcurrent,
  root,
  saveJson,
  sha256,
  webpAsset,
} from "./crawl-common.mjs";

export const currencyWarAssetKinds = {
  currency_war_equipment: "currency-war-equipment",
  currency_war_environments: "currency-war-environment",
  currency_war_strategies: "currency-war-strategy",
  currency_war_bonds: "currency-war-bond",
};

const iconDirectories = {
  "SpriteOutput/GridFight/Equipment": "equipment",
  "SpriteOutput/GridFight/GridItem": "equipment",
  "SpriteOutput/GridFight/Portal": "portal",
  "SpriteOutput/GridFight/AugmentBig": "augmentbig",
  "SpriteOutput/GridFight/TraitIcon/Icon": "icon",
};

export function currencyWarIconUrl(sourcePath) {
  if (typeof sourcePath !== "string")
    throw new Error("Currency War icon path must be a string");
  const directory = iconDirectories[path.posix.dirname(sourcePath)];
  const filename = path.posix.basename(sourcePath);
  if (!directory || !/^[a-zA-Z0-9_-]+\.png$/.test(filename))
    throw new Error(`Unsupported Currency War icon path: ${sourcePath}`);
  return `https://static.nanoka.cc/assets/hsr/gridfight/${directory}/${filename.replace(/\.png$/, ".webp")}`;
}

export async function currencyWarAssetRequests(referenceRoot) {
  const manifest = JSON.parse(
    await readFile(path.join(referenceRoot, "manifest.json"), "utf8")
  );
  const requests = [];
  for (const [collection, kind] of Object.entries(currencyWarAssetKinds)) {
    const filename = `${collection}.json`;
    const bytes = await readFile(path.join(referenceRoot, filename));
    if (sha256(bytes) !== manifest.files[filename]?.sha256)
      throw new Error(`Reference checksum mismatch: ${filename}`);
    const document = JSON.parse(bytes);
    if (
      document.collection !== collection ||
      document.source_revision !== manifest.source.revision ||
      !Array.isArray(document.value) ||
      document.value.length === 0
    )
      throw new Error(`Invalid Currency War reference: ${filename}`);
    const ids = new Set();
    for (const record of document.value) {
      if (typeof record.id !== "string" || !/^\d+$/.test(record.id))
        throw new Error(`Invalid Currency War asset ID: ${collection}`);
      if (ids.has(record.id))
        throw new Error(
          `Duplicate Currency War asset ID: ${collection}:${record.id}`
        );
      ids.add(record.id);
      requests.push({
        kind,
        id: record.id,
        source_url: currencyWarIconUrl(record.icon_path),
      });
    }
  }
  return { source_revision: manifest.source.revision, requests };
}

// Only artwork comes from Nanoka. IDs, inclusion, names and mechanics continue
// to come from the checksummed TurnBasedGameData reference export.
export async function publishCurrencyWarAssets({
  referenceRoot = path.resolve(
    process.env.GILORE_ROOT ?? path.join(root, "../GIlore"),
    "data/reference/honkai_star_rail/v2"
  ),
  cached = false,
} = {}) {
  const directory = path.join(root, "data/source-assets");
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const reference = await currencyWarAssetRequests(referenceRoot);
  if (
    manifest.schema_version !== "1.0.0" ||
    manifest.source_revision !== reference.source_revision
  )
    throw new Error(
      "Currency War source assets do not match reference revision"
    );
  const existing = new Map(
    manifest.entries.map((entry) => [`${entry.kind}:${entry.id}`, entry])
  );
  const downloaded = new Set();
  const entries = await mapConcurrent(reference.requests, async (request) => {
    const previous = existing.get(`${request.kind}:${request.id}`);
    if (previous?.source_url === request.source_url) {
      if (!/^webp\/[a-f0-9]{64}\.webp$/.test(previous.path))
        throw new Error(`Invalid Currency War asset path: ${previous.path}`);
      const bytes = await readFile(path.join(directory, previous.path));
      if (
        sha256(bytes) !== previous.sha256 ||
        bytes.length !== previous.byte_count ||
        path.basename(previous.path, ".webp") !== previous.sha256
      )
        throw new Error(
          `Currency War asset checksum mismatch: ${previous.path}`
        );
      return previous;
    }
    if (cached)
      throw new Error(
        `Currency War artwork is not cached: ${request.kind}:${request.id}`
      );
    const asset = await webpAsset(request.source_url);
    downloaded.add(asset.path);
    return { kind: request.kind, id: request.id, ...asset };
  });
  // Multiple catalog entries share artwork. Copy each content-addressed file
  // once after acquisition so parallel aliases never contend on Windows.
  await mkdir(path.join(directory, "webp"), { recursive: true });
  for (const assetPath of downloaded)
    await copyFile(
      path.join(root, "public/assets/ggstarrail", assetPath),
      path.join(directory, assetPath)
    );
  const kinds = new Set(Object.values(currencyWarAssetKinds));
  await saveJson(manifestPath, {
    ...manifest,
    entries: [
      ...manifest.entries.filter((entry) => !kinds.has(entry.kind)),
      ...entries,
    ].sort((a, b) =>
      `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`, "en")
    ),
  });
  console.log(`Currency War artwork verified: ${entries.length} entries`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--cached", "--help"].includes(arg)))
    throw new Error(
      "Unknown option; run node scripts/currency-war-assets.mjs --help"
    );
  if (args.includes("--help"))
    console.log("node scripts/currency-war-assets.mjs [--cached]");
  else await publishCurrencyWarAssets({ cached: args.includes("--cached") });
}
