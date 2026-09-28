import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const publicDirectory = path.join(root, "public");
const outputDirectory = path.join(root, "dist");
const lookup = JSON.parse(
  await readFile(
    path.join(root, "src/generated/hsr-assets/runtime-lookup.json"),
    "utf8"
  )
);
const expectedImages = new Set(
  lookup.entries.map((entry) => entry[2]).filter(Boolean)
);
let checked = 0;
async function verifyDirectory(relative = "") {
  for (const entry of await readdir(path.join(publicDirectory, relative), {
    withFileTypes: true,
  })) {
    const asset = relative ? `${relative}/${entry.name}` : entry.name;
    if (asset === "assets/ggstarrail/cache") continue;
    if (entry.isDirectory()) {
      await verifyDirectory(asset);
      continue;
    }
    if (
      asset.startsWith("assets/ggstarrail/webp/") &&
      !expectedImages.has(asset.slice("assets/ggstarrail/".length))
    )
      continue;
    const source = await readFile(path.join(publicDirectory, asset));
    const published = await readFile(path.join(outputDirectory, asset));
    assert(source.equals(published), `Public asset differs in build: ${asset}`);
    checked++;
  }
}
await verifyDirectory();
for (const image of expectedImages) {
  assert(
    /^webp\/[a-f0-9]{64}\.webp$/.test(image),
    `Invalid WebP path: ${image}`
  );
  await readFile(path.join(outputDirectory, "assets/ggstarrail", image));
}
const outputImages = await readdir(
  path.join(outputDirectory, "assets/ggstarrail/webp")
);
assert.deepEqual(
  new Set(outputImages.map((name) => `webp/${name}`)),
  expectedImages,
  "Build includes obsolete WebP assets"
);
await assert.rejects(
  readdir(path.join(outputDirectory, "assets/ggstarrail/cache")),
  { code: "ENOENT" }
);
console.log(`Verified ${checked} public assets in production output`);
