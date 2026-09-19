import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root, saveJson, webpAsset } from "./crawl-common.mjs";

// Audited HoYoWiki GIF frame order. Harmony puts Stelle first; the other
// four Paths put Caelus first. Never infer gender from the default GIF frame.
const frames = {
  8001: 0,
  8002: 1,
  8003: 0,
  8004: 1,
  8005: 1,
  8006: 0,
  8007: 0,
  8008: 1,
  8009: 0,
  8010: 1,
};

export function trailblazerPortraitFrame(id) {
  return frames[id];
}

export async function refreshTrailblazerAssets() {
  const directory = path.join(root, "data/source-assets");
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const entry of manifest.entries) {
    const frame =
      entry.kind === "character"
        ? trailblazerPortraitFrame(entry.id)
        : undefined;
    if (frame === undefined) continue;
    const asset = await webpAsset(entry.source_url, frame);
    await copyFile(
      path.join(root, "public/assets/ggstarrail", asset.path),
      path.join(directory, asset.path)
    );
    Object.assign(entry, asset);
  }
  await saveJson(manifestPath, manifest);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await refreshTrailblazerAssets();
}
