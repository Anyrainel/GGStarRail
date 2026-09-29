import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { crawlRoot, root, saveJson, sha256 } from "./crawl-common.mjs";
import { currencyWarAssetKinds } from "./currency-war-assets.mjs";
import { trailblazerPortraitFrame } from "./trailblazer-assets.mjs";

const directory = path.join(root, "data/source-assets");
const manifestPath = path.join(directory, "manifest.json");
export const LIGHT_CONE_WEBP_OPTIONS = { width: 384, quality: 75 };
const kindByCollection = {
  characters: "character",
  light_cones: "light-cone",
  relic_sets: "relic-set",
  ...currencyWarAssetKinds,
};

export async function publishSourceAssets(
  nanokaRoot = path.join(crawlRoot, "nanoka"),
  evidencePath = path.join(crawlRoot, "hoyolab.json")
) {
  const official = JSON.parse(await readFile(evidencePath, "utf8"));
  const beta = JSON.parse(
    await readFile(path.join(nanokaRoot, "latest.json"), "utf8")
  );
  if (official.source_revision !== beta.source_revision)
    throw new Error("Source asset evidence revisions differ");
  const entries = new Map();
  // Official evidence wins same-ID image collisions. The beta crawler also treats
  // unknown release status conservatively and never promotes an entity itself.
  for (const evidence of [beta, official]) {
    for (const entry of evidence.entries) {
      const kind = kindByCollection[entry.collection];
      if (!kind || !entry.asset) continue;
      const asset = entry.asset;
      if (!/^webp\/[a-f0-9]{64}\.webp$/.test(asset.path))
        throw new Error(`Invalid source asset path: ${asset.path}`);
      const bytes = await readFile(
        path.join(root, "public/assets/ggstarrail", asset.path)
      );
      if (sha256(bytes) !== asset.sha256)
        throw new Error(`Source WebP checksum mismatch: ${asset.path}`);
      const target = path.join(directory, asset.path);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(
        path.join(root, "public/assets/ggstarrail", asset.path),
        target
      );
      entries.set(`${kind}:${entry.id}`, { kind, id: entry.id, ...asset });
    }
  }
  await saveJson(manifestPath, {
    schema_version: "1.0.0",
    source_revision: official.source_revision,
    entries: [...entries.values()].sort((a, b) =>
      `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`, "en")
    ),
  });
}

export async function restoreSourceAssets(lookup) {
  const bytes = await readFile(manifestPath);
  const manifest = JSON.parse(bytes);
  const reference = JSON.parse(
    await readFile(path.join(root, "src/data/game/manifest.json"), "utf8")
  );
  if (
    manifest.schema_version !== "1.0.0" ||
    manifest.source_revision !== reference.source_revision
  )
    throw new Error("Tracked source assets do not match reference revision");
  const entries = new Map(
    lookup.entries.map((entry) => [`${entry[0]}:${entry[1]}`, entry])
  );
  for (const entry of manifest.entries) {
    const expectedFrame =
      entry.kind === "character"
        ? trailblazerPortraitFrame(entry.id)
        : undefined;
    if (expectedFrame !== undefined && entry.source_frame !== expectedFrame) {
      throw new Error(
        `Trailblazer gender frame missing or mismatched: ${entry.id}`
      );
    }
    if (
      !Object.values(kindByCollection).includes(entry.kind) ||
      !/^webp\/[a-f0-9]{64}\.webp$/.test(entry.path)
    )
      throw new Error("Invalid tracked source asset entry");
    const payload = await readFile(path.join(directory, entry.path));
    if (
      sha256(payload) !== entry.sha256 ||
      path.basename(entry.path, ".webp") !== entry.sha256
    )
      throw new Error(`Tracked source asset checksum mismatch: ${entry.path}`);
    const output =
      entry.kind === "light-cone"
        ? await sharp(payload)
            .resize({
              width: LIGHT_CONE_WEBP_OPTIONS.width,
              withoutEnlargement: true,
            })
            .webp({ quality: LIGHT_CONE_WEBP_OPTIONS.quality, effort: 4 })
            .toBuffer()
        : payload;
    const outputPath =
      entry.kind === "light-cone" ? `webp/${sha256(output)}.webp` : entry.path;
    const target = path.join(root, "public/assets/ggstarrail", outputPath);
    await mkdir(path.dirname(target), { recursive: true });
    if (entry.kind === "light-cone") await writeFile(target, output);
    else await copyFile(path.join(directory, entry.path), target);
    entries.set(`${entry.kind}:${entry.id}`, [
      entry.kind,
      entry.id,
      outputPath,
    ]);
  }
  for (const id of ["8001", "8003", "8005", "8007", "8009"]) {
    const male = manifest.entries.find(
      (entry) => entry.kind === "character" && entry.id === id
    );
    const female = manifest.entries.find(
      (entry) =>
        entry.kind === "character" && entry.id === String(Number(id) + 1)
    );
    if (!male || !female || male.sha256 === female.sha256)
      throw new Error(`Missing distinct Trailblazer portraits: ${id}`);
  }
  return {
    ...lookup,
    source_assets_sha256: sha256(bytes),
    entries: [...entries.values()],
  };
}
