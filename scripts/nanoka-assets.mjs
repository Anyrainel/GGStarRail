import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";
import sharp from "sharp";
import {
  fetchBytes,
  mapConcurrent,
  root,
  saveJson,
  sha256,
} from "./crawl-common.mjs";
import {
  acquireHoyowikiAvatarFallback,
  validateHoyowikiAvatarFallback,
} from "./hoyowiki-avatar-fallback.mjs";

const host = "https://static.nanoka.cc/assets/hsr";
export const catalogArtworkKinds = [
  "character",
  "light-cone",
  "relic-set",
  "relic-piece",
];

export function nanokaArtworkRequests(collection, records) {
  return records.flatMap((record) => {
    const id = String(record.id);
    if (!/^\d+$/.test(id)) throw new Error(`Invalid Nanoka artwork ID: ${id}`);
    if (collection === "characters")
      return [
        {
          kind: "character",
          id,
          variant: "avatar",
          source_url: `${host}/avataricon/avatar/${id}.webp`,
          ...(record.artwork_preview ? { preview: true } : {}),
        },
        {
          kind: "character",
          id,
          variant: "round",
          source_url: `${host}/avatarroundicon/${id}.webp`,
        },
      ];
    if (collection === "light_cones")
      return [
        {
          kind: "light-cone",
          id,
          variant: "portrait",
          source_url: `${host}/lightconemaxfigures/${id}.webp`,
        },
        {
          kind: "light-cone",
          id,
          variant: "icon",
          source_url: `${host}/lightconemediumicon/${id}.webp`,
        },
      ];
    const filename = path.posix.basename(record.icon_path ?? "");
    if (!/^[A-Za-z0-9_]+\.png$/.test(filename))
      throw new Error(`Invalid Nanoka artwork path: ${record.icon_path}`);
    return [
      {
        kind: collection === "relic_sets" ? "relic-set" : "relic-piece",
        id,
        source_url: `${host}/${collection === "relic_sets" ? "itemfigures" : "relicfigures"}/${filename.replace(/\.png$/, ".webp")}`,
      },
    ];
  });
}

export async function catalogArtworkRequests(catalogRoot, cachedAssets = []) {
  const manifest = JSON.parse(
    await readFile(path.join(catalogRoot, "manifest.json"), "utf8")
  );
  const requests = [];
  for (const collection of [
    "characters",
    "light_cones",
    "relic_sets",
    "relic_pieces",
  ]) {
    const records = new Map();
    if (manifest.members) {
      for (const channel of ["released", "beta"]) {
        const descriptor = manifest.members[collection][channel].stats;
        const bytes = await readFile(path.join(catalogRoot, descriptor.path));
        if (sha256(bytes) !== descriptor.sha256)
          throw new Error(
            `Catalog artwork checksum mismatch: ${descriptor.path}`
          );
        const document = JSON.parse(
          channel === "beta" ? gunzipSync(bytes) : bytes
        );
        for (const record of document.value) records.set(record.id, record);
      }
      const preview = manifest.members[`nanoka_${collection}`];
      if (preview)
        for (const channel of ["released", "beta"]) {
          const descriptor = preview[channel].stats;
          const bytes = await readFile(path.join(catalogRoot, descriptor.path));
          if (sha256(bytes) !== descriptor.sha256)
            throw new Error(
              `Preview artwork checksum mismatch: ${descriptor.path}`
            );
          const document = JSON.parse(
            channel === "beta" ? gunzipSync(bytes) : bytes
          );
          for (const record of document.value)
            if (!records.has(record.id))
              records.set(record.id, { ...record, artwork_preview: true });
        }
    } else {
      const filename = `${collection}.json`;
      const bytes = await readFile(path.join(catalogRoot, filename));
      if (sha256(bytes) !== manifest.files[filename]?.sha256)
        throw new Error(`Reference artwork checksum mismatch: ${filename}`);
      for (const record of JSON.parse(bytes).value)
        records.set(record.id, record);
    }
    // Preview set rows contain only mechanics. Obtain their declared icon mapping,
    // without copying names, release status or mechanics from the artwork source.
    const missing = [...records.values()].filter(
      (record) => collection === "relic_sets" && !record.icon_path
    );
    for (const record of missing) {
      const old = cachedAssets.find(
        (entry) => entry.kind === "relic-set" && entry.id === record.id
      );
      if (old?.source_url.startsWith(`${host}/itemfigures/`))
        record.icon_path = path.posix
          .basename(old.source_url)
          .replace(/\.webp$/, ".png");
    }
    if (missing.some((record) => !record.icon_path)) {
      const versions = JSON.parse(
        await fetchBytes("https://static.nanoka.cc/manifest.json")
      );
      const index = JSON.parse(
        await fetchBytes(
          `https://static.nanoka.cc/hsr/${versions.hsr.latest}/relicset.json`
        )
      );
      for (const record of missing)
        if (!record.icon_path) record.icon_path = index[record.id]?.icon;
    }
    requests.push(...nanokaArtworkRequests(collection, [...records.values()]));
  }
  return {
    source_revision: manifest.source_revision ?? manifest.source.revision,
    requests,
  };
}

export async function publishNanokaArtwork({
  catalogRoot,
  cached = false,
  outputDirectory = path.join(root, "data/source-assets"),
}) {
  let previous = { entries: [] };
  try {
    previous = JSON.parse(
      await readFile(path.join(outputDirectory, "manifest.json"), "utf8")
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const inventory = await catalogArtworkRequests(catalogRoot, previous.entries);
  const unavailable = new Map(
    previous.entries
      .filter((entry) => entry.availability === "unavailable")
      .map((entry) => [entry.source_url, entry])
  );
  const byUrl = new Map(
    previous.entries
      .filter((entry) => entry.path && entry.source_sha256 === entry.sha256)
      .map((entry) => [entry.source_url, entry])
  );
  const downloads = new Map();
  const fallbackByPrimaryUrl = new Map(
    previous.entries
      .filter((entry) => entry.source_provider === "hoyowiki")
      .map((entry) => [entry.primary_source_url, entry])
  );
  await mkdir(path.join(outputDirectory, "webp"), { recursive: true });
  const entries = await mapConcurrent(inventory.requests, async (request) => {
    if (!downloads.has(request.source_url))
      downloads.set(
        request.source_url,
        (async () => {
          const previousFallback = fallbackByPrimaryUrl.get(request.source_url);
          if (cached && previousFallback) {
            await validateHoyowikiAvatarFallback(
              previousFallback,
              outputDirectory
            );
            const bytes = await readFile(
              path.join(outputDirectory, previousFallback.path)
            );
            if (
              sha256(bytes) !== previousFallback.sha256 ||
              bytes.length !== previousFallback.byte_count
            )
              throw new Error(`Corrupted HoYoWiki Avatar cache: ${request.id}`);
            return previousFallback;
          }
          const absent = cachedUnavailableArtwork(
            request,
            unavailable.get(request.source_url),
            cached
          );
          if (absent) return absent;
          const old = byUrl.get(request.source_url);
          let bytes;
          if (old) {
            bytes = await readFile(path.join(outputDirectory, old.path));
            if (sha256(bytes) !== old.sha256 || bytes.length !== old.byte_count)
              throw new Error(`Corrupted Nanoka cache: ${old.path}`);
          } else {
            if (cached)
              throw new Error(
                `Nanoka artwork is not cached: ${request.source_url}`
              );
            try {
              bytes = await fetchBytes(request.source_url);
            } catch (error) {
              if (
                request.kind === "character" &&
                request.variant === "avatar" &&
                error.message.startsWith("Source HTTP 404:")
              ) {
                const fallback = await acquireHoyowikiAvatarFallback(
                  request,
                  outputDirectory
                );
                return (
                  fallback ?? {
                    availability: "unavailable",
                    source_http_status: 404,
                  }
                );
              }
              throw error;
            }
          }
          const metadata = await sharp(bytes).metadata();
          if (metadata.format !== "webp" || !metadata.width || !metadata.height)
            throw new Error(`Invalid Nanoka WebP: ${request.source_url}`);
          const hash = sha256(bytes);
          const assetPath = `webp/${hash}.webp`;
          await writeFile(path.join(outputDirectory, assetPath), bytes);
          const publicPath = path.join(
            root,
            "public/assets/ggstarrail",
            assetPath
          );
          await mkdir(path.dirname(publicPath), { recursive: true });
          await copyFile(path.join(outputDirectory, assetPath), publicPath);
          return {
            source_sha256: hash,
            path: assetPath,
            sha256: hash,
            byte_count: bytes.length,
            width: metadata.width,
            height: metadata.height,
          };
        })()
      );
    return { ...request, ...(await downloads.get(request.source_url)) };
  });
  await saveJson(path.join(outputDirectory, "manifest.json"), {
    schema_version: "2.0.0",
    source_revision: inventory.source_revision,
    entries: [
      ...previous.entries.filter(
        (entry) => !catalogArtworkKinds.includes(entry.kind)
      ),
      ...entries,
    ].sort((a, b) =>
      `${a.kind}:${a.id}:${a.variant ?? ""}`.localeCompare(
        `${b.kind}:${b.id}:${b.variant ?? ""}`,
        "en"
      )
    ),
  });
  console.log(
    `Nanoka artwork verified: ${entries.length} mappings / ${downloads.size} original WebPs`
  );
  return entries;
}

export function cachedUnavailableArtwork(request, previous, cached) {
  if (!cached || !previous) return null;
  if (
    request.kind !== "character" ||
    request.variant !== "avatar" ||
    previous.kind !== request.kind ||
    previous.id !== request.id ||
    previous.variant !== request.variant ||
    previous.source_url !== request.source_url ||
    previous.availability !== "unavailable" ||
    previous.source_http_status !== 404 ||
    previous.path !== undefined
  )
    throw new Error(`Invalid unavailable Nanoka cache: ${request.source_url}`);
  return { availability: "unavailable", source_http_status: 404 };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { values } = parseArgs({
    options: {
      "catalog-root": { type: "string" },
      cached: { type: "boolean", default: false },
    },
  });
  await publishNanokaArtwork({
    catalogRoot: path.resolve(
      values["catalog-root"] ?? path.join(root, "src/generated/catalog")
    ),
    cached: values.cached,
  });
}
