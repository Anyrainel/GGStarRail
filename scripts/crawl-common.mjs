import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const root = path.resolve(import.meta.dirname, "..");
export const crawlRoot = path.join(root, ".cache/data-sources");
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export const plainName = (name) =>
  name
    .replace(/<[^>]+>/g, "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
const assetPromises = new Map();

export async function saveJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${file}.tmp`, file);
}

export async function fetchBytes(url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(45_000),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if ((response.status !== 429 && response.status < 500) || attempt === 2)
      throw new Error(`Source HTTP ${response.status}: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error(`Source exhausted retries: ${url}`);
}

export async function mapConcurrent(values, action, concurrency = 6) {
  let next = 0;
  const result = Array(values.length);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= values.length) return;
        result[index] = await action(values[index], index);
      }
    })
  );
  return result;
}

export async function webpAsset(url) {
  if (!assetPromises.has(url)) assetPromises.set(url, encodeAsset(url));
  return assetPromises.get(url);
}

async function encodeAsset(url) {
  const bytes = await fetchBytes(url);
  const output = await sharp(bytes)
    .webp({ quality: 90, alphaQuality: 100, effort: 4 })
    .toBuffer();
  const hash = sha256(output);
  const target = path.join(
    root,
    "public/assets/ggstarrail/webp",
    `${hash}.webp`
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, output);
  return {
    source_url: url,
    source_sha256: sha256(bytes),
    path: `webp/${hash}.webp`,
    sha256: hash,
    byte_count: output.length,
  };
}

export async function referenceDocuments(referenceRoot) {
  const manifest = JSON.parse(
    await readFile(path.join(referenceRoot, "manifest.json"), "utf8")
  );
  const documents = {};
  for (const name of [
    "characters",
    "light_cones",
    "relic_sets",
    "achievements",
    "progression",
  ]) {
    const filename = `${name}.json`;
    const bytes = await readFile(path.join(referenceRoot, filename));
    if (sha256(bytes) !== manifest.files[filename]?.sha256)
      throw new Error(`Reference checksum mismatch: ${filename}`);
    documents[name] = JSON.parse(bytes).value;
  }
  return { manifest, documents };
}

export function exactNameIndex(records) {
  const result = new Map();
  for (const record of records) {
    for (const [locale, text] of Object.entries(record.name)) {
      const key = `${locale}:${plainName(text.value)}`;
      const ids = result.get(key) ?? new Set();
      ids.add(String(record.id));
      result.set(key, ids);
    }
  }
  return result;
}
