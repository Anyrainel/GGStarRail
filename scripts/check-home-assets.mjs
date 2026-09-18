import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const home = await readFile(path.join(root, "src/pages/HomePage.tsx"), "utf8");
const assets = new Set(
  Array.from(
    home.matchAll(/"(assets\/ggstarrail\/[^"\s]+)"/g),
    (match) => match[1]
  )
);
assert(assets.size > 0, "Home page asset references were not found");
for (const asset of assets) {
  const source = await readFile(path.join(root, "public", asset));
  const published = await readFile(path.join(root, "dist", asset));
  assert(
    source.equals(published),
    `Home page asset differs in build: ${asset}`
  );
}
console.log(`Verified ${assets.size} home page assets in production output`);
