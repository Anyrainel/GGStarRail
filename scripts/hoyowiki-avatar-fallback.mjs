import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fetchBytes, sha256 } from "./crawl-common.mjs";

// Audited standard portraits only. Do not accept arbitrary HoYoWiki uploads:
// Aeon Aha's current 118×130 icon is a different crop and is deliberately absent.
const pages = {
  1507: { id: "5217", name: "Mortenax Blade" },
  1512: { id: "6565", name: "Robin • Summeretto" },
  1513: { id: "6566", name: "Aventurine • Waveflair" },
};

function validImageUrl(value) {
  const source = new URL(value);
  return (
    source.protocol === "https:" &&
    ((source.hostname === "act-upload.hoyoverse.com" &&
      source.pathname.startsWith("/event-ugc-hoyowiki/")) ||
      (source.hostname === "upload-static.hoyoverse.com" &&
        source.pathname.startsWith("/hoyowiki/")))
  );
}

export function validateHoyowikiAvatarSource(entry) {
  const page = pages[entry.id];
  if (
    entry.source_provider !== "hoyowiki" ||
    entry.kind !== "character" ||
    entry.variant !== "avatar" ||
    !page ||
    entry.source_page_url !==
      `https://wiki.hoyolab.com/pc/hsr/entry/${page.id}` ||
    entry.primary_source_url !==
      `https://static.nanoka.cc/assets/hsr/avataricon/avatar/${entry.id}.webp` ||
    entry.primary_source_http_status !== 404 ||
    !validImageUrl(entry.source_url) ||
    entry.width !== 160 ||
    entry.height !== 188 ||
    !["original-webp", "webp-lossless"].includes(entry.encoding) ||
    !/^[a-f0-9]{64}$/.test(entry.source_sha256) ||
    !/^[a-f0-9]{64}$/.test(entry.sha256) ||
    !/^[a-f0-9]{64}$/.test(entry.source_page_sha256) ||
    entry.path !== `webp/${entry.sha256}.webp` ||
    (entry.source_format === "webp"
      ? entry.encoding !== "original-webp" ||
        entry.original_path !== `webp/${entry.source_sha256}.webp` ||
        entry.sha256 !== entry.source_sha256
      : entry.source_format !== "png" ||
        entry.encoding !== "webp-lossless" ||
        entry.original_path !== `originals/${entry.source_sha256}.png`)
  )
    throw new Error(`Invalid HoYoWiki Avatar fallback: ${entry.id}`);
}

export async function validateHoyowikiAvatarFallback(entry, directory) {
  validateHoyowikiAvatarSource(entry);
  const original = await readFile(path.join(directory, entry.original_path));
  if (
    sha256(original) !== entry.source_sha256 ||
    original.length !== entry.original_byte_count
  )
    throw new Error(`HoYoWiki Avatar original checksum mismatch: ${entry.id}`);
  const metadata = await sharp(original).metadata();
  if (
    metadata.format !== entry.source_format ||
    metadata.width !== 160 ||
    metadata.height !== 188
  )
    throw new Error(
      `HoYoWiki Avatar original dimensions mismatch: ${entry.id}`
    );
}

export async function acquireHoyowikiAvatarFallback(
  request,
  directory,
  fetchSource = fetchBytes
) {
  const page = pages[request.id];
  if (request.kind !== "character" || request.variant !== "avatar" || !page)
    return null;
  const pageBytes = await fetchSource(
    `https://sg-wiki-api.hoyolab.com/hoyowiki/hsr/wapi/entry_page?entry_page_id=${page.id}`,
    {
      headers: {
        "x-rpc-wiki_app": "hsr",
        "x-rpc-language": "en-us",
        Origin: "https://wiki.hoyolab.com",
        Referer: "https://wiki.hoyolab.com/",
      },
    }
  );
  const response = JSON.parse(pageBytes);
  const data = response.data?.page;
  if (
    response.retcode !== 0 ||
    !data ||
    String(data.id) !== page.id ||
    data.name !== page.name ||
    data.beta !== false ||
    data.status !== "Online"
  )
    throw new Error(`HoYoWiki Avatar page identity mismatch: ${request.id}`);
  const base = {
    ...request,
    source_provider: "hoyowiki",
    primary_source_url: request.source_url,
    primary_source_http_status: 404,
    source_url: data.icon_url,
    source_page_url: `https://wiki.hoyolab.com/pc/hsr/entry/${page.id}`,
    source_page_sha256: sha256(pageBytes),
    width: 160,
    height: 188,
  };
  // Validate the host before fetching the page's externally supplied URL.
  if (!validImageUrl(data.icon_url))
    throw new Error(`Invalid HoYoWiki image URL: ${request.id}`);
  const original = await fetchSource(data.icon_url);
  const metadata = await sharp(original).metadata();
  if (
    !["png", "webp"].includes(metadata.format) ||
    metadata.width !== 160 ||
    metadata.height !== 188
  )
    throw new Error(
      `HoYoWiki Avatar must be 160×188 PNG or WebP: ${request.id}`
    );
  const originalHash = sha256(original);
  const output =
    metadata.format === "webp"
      ? original
      : await sharp(original).webp({ lossless: true, effort: 4 }).toBuffer();
  const hash = sha256(output);
  const result = {
    ...base,
    source_sha256: originalHash,
    original_path:
      metadata.format === "webp"
        ? `webp/${originalHash}.webp`
        : `originals/${originalHash}.png`,
    source_format: metadata.format,
    encoding: metadata.format === "webp" ? "original-webp" : "webp-lossless",
    original_byte_count: original.length,
    path: `webp/${hash}.webp`,
    sha256: hash,
    byte_count: output.length,
  };
  await mkdir(path.join(directory, "originals"), { recursive: true });
  await mkdir(path.join(directory, "webp"), { recursive: true });
  await writeFile(path.join(directory, result.original_path), original);
  await writeFile(path.join(directory, result.path), output);
  return result;
}
