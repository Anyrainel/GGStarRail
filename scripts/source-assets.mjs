import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { validateEncodedArtwork } from "./artwork-encoding.mjs";
import { root, sha256 } from "./crawl-common.mjs";
import { currencyWarAssetKinds } from "./currency-war-assets.mjs";
import { validateHoyowikiAvatarFallback } from "./hoyowiki-avatar-fallback.mjs";
import {
  catalogArtworkKinds,
  nanokaArtworkRequests,
  publishNanokaArtwork,
} from "./nanoka-assets.mjs";

const directory = path.join(root, "data/source-assets");
const manifestPath = path.join(directory, "manifest.json");
// Applies only to the legacy producer snapshot before Nanoka artwork replaces it.
export const LIGHT_CONE_WEBP_OPTIONS = { width: 384, quality: 75 };

export async function publishSourceAssets(catalogRoot, cached = false) {
  return publishNanokaArtwork({ catalogRoot, cached });
}

export function sourceAssetVariant(entry) {
  if (entry.kind === "character") {
    if (!["avatar", "round"].includes(entry.variant))
      throw new Error(`Invalid character artwork variant: ${entry.id}`);
    return entry.variant;
  }
  if (entry.kind === "light-cone") {
    if (!["portrait", "icon"].includes(entry.variant))
      throw new Error(`Invalid Light Cone artwork variant: ${entry.id}`);
    return entry.variant;
  }
  if (entry.variant !== undefined)
    throw new Error(`Unexpected artwork variant: ${entry.kind}`);
  return null;
}

export async function restoreSourceAssets(lookup) {
  const bytes = await readFile(manifestPath);
  const manifest = JSON.parse(bytes);
  const reference = JSON.parse(
    await readFile(
      path.join(root, "src/generated/catalog/manifest.json"),
      "utf8"
    )
  );
  if (
    manifest.schema_version !== "3.0.0" ||
    manifest.source_revision !== reference.source_revision
  )
    throw new Error("Tracked source assets do not match reference revision");
  const kinds = new Set([
    ...catalogArtworkKinds,
    ...Object.values(currencyWarAssetKinds),
  ]);
  const entries = new Map(
    lookup.entries
      .filter((entry) => !kinds.has(entry[0]))
      .map(([kind, id, assetPath, variant]) => [
        `${kind}:${id}:${variant ?? ""}`,
        [kind, id, assetPath, variant ?? null],
      ])
  );
  const sourceKeys = new Set();
  for (const entry of manifest.entries) {
    const variant = sourceAssetVariant(entry);
    const key = `${entry.kind}:${entry.id}:${variant ?? ""}`;
    if (
      !kinds.has(entry.kind) ||
      !/^\d+$/.test(entry.id) ||
      sourceKeys.has(key)
    )
      throw new Error(`Invalid tracked source asset entry: ${key}`);
    sourceKeys.add(key);
    const hoyowiki = entry.source_provider === "hoyowiki";
    if (hoyowiki) await validateHoyowikiAvatarFallback(entry, directory);
    if (
      !hoyowiki &&
      (entry.kind === "character" || entry.kind === "light-cone")
    ) {
      const expected = nanokaArtworkRequests(
        entry.kind === "character" ? "characters" : "light_cones",
        [{ id: entry.id }]
      ).find((request) => request.variant === variant);
      if (entry.source_url !== expected.source_url)
        throw new Error(`Unexpected Nanoka artwork URL: ${key}`);
    }
    if (
      !hoyowiki &&
      !entry.source_url.startsWith("https://static.nanoka.cc/assets/hsr/")
    )
      throw new Error(`Non-Nanoka source artwork: ${key}`);
    if (entry.availability === "unavailable") {
      if (
        entry.source_http_status !== 404 ||
        entry.kind !== "character" ||
        entry.variant !== "avatar"
      )
        throw new Error(`Invalid unavailable artwork: ${key}`);
      entries.set(key, [entry.kind, entry.id, null, variant]);
      continue;
    }
    if (!/^webp\/[a-f0-9]{64}\.webp$/.test(entry.path))
      throw new Error(`Invalid tracked source asset path: ${key}`);
    const payload = await readFile(path.join(directory, entry.path));
    if (
      sha256(payload) !== entry.sha256 ||
      path.basename(entry.path, ".webp") !== entry.sha256 ||
      payload.length !== entry.byte_count
    )
      throw new Error(`Tracked source asset checksum mismatch: ${entry.path}`);
    if (catalogArtworkKinds.includes(entry.kind))
      await validateEncodedArtwork(entry, payload);
    const target = path.join(root, "public/assets/ggstarrail", entry.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(directory, entry.path), target);
    entries.set(key, [entry.kind, entry.id, entry.path, variant]);
  }
  for (const id of ["8001", "8003", "8005", "8007", "8009"])
    for (const variant of ["avatar", "round"]) {
      const male = manifest.entries.find(
        (entry) =>
          entry.kind === "character" &&
          entry.id === id &&
          entry.variant === variant
      );
      const female = manifest.entries.find(
        (entry) =>
          entry.kind === "character" &&
          entry.id === String(Number(id) + 1) &&
          entry.variant === variant
      );
      if (!male || !female || male.sha256 === female.sha256)
        throw new Error(
          `Missing distinct Trailblazer portraits: ${id}:${variant}`
        );
    }
  return {
    ...lookup,
    lookup_schema_version: "2",
    source_assets_sha256: sha256(bytes),
    entries: [...entries.values()],
  };
}
