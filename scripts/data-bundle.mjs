import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { create, extract } from "tar";
import {
  DEFAULT_ASSET_CACHE_DIRECTORY,
  DEFAULT_ASSET_LOOKUP_DIRECTORY,
  syncAssetBundle,
  validateAssetDirectory,
} from "./sync-hsr-assets.mjs";
import {
  syncReferenceBundle,
  validateBundleDirectory,
} from "./sync-hsr-reference.mjs";

const root = path.resolve(import.meta.dirname, "..");
const reference = path.join(root, "src/generated/hsr-reference");
const lockPath = path.join(root, "data-bundle.lock.json");
const scratch = path.join(root, "test-results");
await mkdir(scratch, { recursive: true });
const stage = await mkdtemp(path.join(scratch, "data-bundle-"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
try {
  if (process.argv[2] === "package") {
    const validated = await validateBundleDirectory(reference);
    await validateAssetDirectory(
      DEFAULT_ASSET_CACHE_DIRECTORY,
      path.join(reference, "manifest.json")
    );
    await cp(reference, path.join(stage, "reference"), { recursive: true });
    await cp(DEFAULT_ASSET_CACHE_DIRECTORY, path.join(stage, "assets"), {
      recursive: true,
    });
    const output = path.join(scratch, "hsr-data.tar.gz");
    await create(
      {
        cwd: stage,
        file: output,
        gzip: true,
        portable: true,
        mtime: new Date(0),
      },
      ["reference", "assets"]
    );
    const bytes = await readFile(output);
    const digest = hash(bytes);
    const tag = `data-${digest.slice(0, 16)}`;
    await writeFile(
      lockPath,
      `${JSON.stringify(
        {
          url: `https://github.com/Anyrainel/GGStarRail/releases/download/${tag}/hsr-data.tar.gz`,
          sha256: digest,
          sourceRevision: validated.manifest.source.revision,
        },
        null,
        2
      )}\n`
    );
    console.log(
      `Created ${output} (${bytes.length} bytes). Upload to release ${tag} before pushing the lockfile.`
    );
  } else if (process.argv[2] === "restore") {
    const lock = JSON.parse(await readFile(lockPath, "utf8"));
    if (!/^[a-f0-9]{64}$/.test(lock.sha256))
      throw new Error("Invalid data bundle digest");
    const url = new URL(lock.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      !url.pathname.startsWith("/Anyrainel/GGStarRail/releases/download/")
    )
      throw new Error("Unexpected data bundle URL");
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok)
      throw new Error(`Data bundle download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== lock.sha256)
      throw new Error("Data bundle checksum mismatch");
    const archive = path.join(stage, "bundle.tar.gz");
    await writeFile(archive, bytes);
    await extract({
      cwd: stage,
      file: archive,
      strict: true,
      filter(name, entry) {
        if (
          !/^(reference|assets)(\/|$)/.test(name) ||
          name.split("/").includes("..") ||
          name.includes("\\") ||
          !["File", "Directory"].includes(entry.type)
        )
          throw new Error(`Unsafe archive entry: ${name}`);
        return true;
      },
    });
    const validated = await validateBundleDirectory(
      path.join(stage, "reference")
    );
    if (validated.manifest.source.revision !== lock.sourceRevision)
      throw new Error("Data bundle revision mismatch");
    await validateAssetDirectory(
      path.join(stage, "assets"),
      path.join(stage, "reference/manifest.json")
    );
    await syncReferenceBundle(path.join(stage, "reference"), reference);
    await syncAssetBundle(
      path.join(stage, "assets"),
      DEFAULT_ASSET_CACHE_DIRECTORY,
      DEFAULT_ASSET_LOOKUP_DIRECTORY,
      path.join(reference, "manifest.json")
    );
    console.log(`Restored verified data bundle ${lock.sha256}`);
  } else {
    throw new Error("Usage: node scripts/data-bundle.mjs package|restore");
  }
} finally {
  await rm(stage, { recursive: true, force: true });
}
