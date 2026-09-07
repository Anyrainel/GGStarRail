import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  DEFAULT_ASSET_CACHE_DIRECTORY,
  validatePublishedAssets,
} from "./sync-hsr-assets.mjs";

const root = path.resolve(import.meta.dirname, "..");
const validated = await validatePublishedAssets();
const media = path.join(root, "public/assets/ggstarrail/webp");
const generated = path.join(root, "src/generated/hsr-assets");
const encoder = JSON.stringify({
  sharp: sharp.versions,
  quality: 85,
  alphaQuality: 100,
  effort: 4,
});
const lookupPath = path.join(generated, "runtime-lookup.json");
// Avoid re-encoding unchanged inputs on every code-only build. Verify all
// cached bytes so a stale or incomplete cache never bypasses asset checks.
try {
  const cached = JSON.parse(await readFile(lookupPath, "utf8"));
  if (
    cached.asset_manifest_sha256 === validated.manifestSha256 &&
    cached.webp_encoder === encoder
  ) {
    const files = new Set(
      cached.entries.map((entry) => entry[2]).filter(Boolean)
    );
    for (const file of files) {
      if (!/^webp\/[a-f0-9]{64}\.webp$/.test(file))
        throw new Error("Invalid cached WebP path");
      const bytes = await readFile(path.join(media, path.basename(file)));
      if (
        createHash("sha256").update(bytes).digest("hex") !==
        path.basename(file, ".webp")
      )
        throw new Error("WebP cache checksum mismatch");
    }
    console.log(`WebP cache verified: ${files.size} images`);
    process.exit(0);
  }
} catch (error) {
  if (error.code !== "ENOENT")
    console.log(`Rebuilding WebP cache: ${error.message}`);
}
await mkdir(media, { recursive: true });
await mkdir(generated, { recursive: true });
const paths = new Map();
let sourceBytes = 0;
let outputBytes = 0;
// Preserve full dimensions and alpha; hash the encoded bytes, not source paths.
// Encoding changes therefore produce a new URL without purging old clients.
for (const assetPath of [...validated.assetPaths.keys()].sort()) {
  const png = await readFile(
    path.join(DEFAULT_ASSET_CACHE_DIRECTORY, assetPath)
  );
  const webp = await sharp(png)
    .webp({ quality: 85, alphaQuality: 100, effort: 4 })
    .toBuffer();
  const hash = createHash("sha256").update(webp).digest("hex");
  await writeFile(path.join(media, `${hash}.webp`), webp);
  paths.set(`cache/gilore/v1/${assetPath}`, `webp/${hash}.webp`);
  sourceBytes += png.length;
  outputBytes += webp.length;
}
const lookup = {
  ...validated.lookup,
  webp_encoder: encoder,
  entries: validated.lookup.entries.map(([kind, id, assetPath]) => {
    const output = assetPath === null ? null : paths.get(assetPath);
    if (output === undefined) throw new Error(`Missing WebP for ${kind}:${id}`);
    return [kind, id, output];
  }),
};
await writeFile(
  path.join(generated, "runtime-lookup.json"),
  `${JSON.stringify(lookup)}\n`
);
console.log(
  `WebP: ${paths.size} images; ${sourceBytes} PNG bytes -> ${outputBytes} WebP bytes (${Math.round(100 * (1 - outputBytes / sourceBytes))}% smaller)`
);
