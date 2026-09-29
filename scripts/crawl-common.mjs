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

export async function webpAsset(url, frame, previous) {
  const key = `${url}#${frame ?? "default"}`;
  if (!assetPromises.has(key)) {
    const pending = reuseOrEncodeAsset(url, frame, previous);
    assetPromises.set(key, pending);
    pending.then(
      () => assetPromises.delete(key),
      () => assetPromises.delete(key)
    );
  }
  return assetPromises.get(key);
}

async function reuseOrEncodeAsset(url, frame, previous) {
  return (
    (await reusableWebpAsset(url, frame, previous)) ?? encodeAsset(url, frame)
  );
}

export async function reusableWebpAsset(
  url,
  frame,
  previous,
  assetDirectory = path.join(root, "public/assets/ggstarrail")
) {
  if (
    previous?.source_url === url &&
    previous.source_frame === frame &&
    /^webp\/[a-f0-9]{64}\.webp$/.test(previous.path) &&
    previous.path === `webp/${previous.sha256}.webp`
  ) {
    try {
      const bytes = await readFile(path.join(assetDirectory, previous.path));
      if (
        bytes.length === previous.byte_count &&
        sha256(bytes) === previous.sha256
      )
        return previous;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function encodeAsset(url, frame) {
  const bytes = await fetchBytes(url);
  if (frame !== undefined) {
    const metadata = await sharp(bytes, { animated: true }).metadata();
    if (metadata.pages !== 2)
      throw new Error(`Expected two Trailblazer portrait frames: ${url}`);
  }
  const output = await sharp(
    bytes,
    frame === undefined ? {} : { page: frame, pages: 1 }
  )
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
    ...(frame === undefined ? {} : { source_frame: frame }),
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
