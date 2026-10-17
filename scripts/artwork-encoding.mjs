import sharp from "sharp";
import { sha256 } from "./crawl-common.mjs";

export function artworkEncodingPolicy(kind, variant) {
  if (kind === "character" && variant === "avatar")
    return { id: "webp-avatar-160x188-q85-v1", width: 160, height: 188 };
  if (kind === "character" && variant === "round")
    return { id: "webp-round-128-q85-v1", width: 128, height: 128 };
  if (kind === "light-cone" && ["portrait", "icon"].includes(variant))
    return { id: "webp-cone-256-q85-v1", width: 256 };
  if (["relic-set", "relic-piece"].includes(kind))
    return { id: "webp-relic-256-q85-v1", width: 256, height: 256 };
  throw new Error(`Unknown artwork encoding: ${kind}:${variant}`);
}

export async function encodeArtwork(input, kind, variant) {
  const policy = artworkEncodingPolicy(kind, variant);
  const source = await sharp(input).metadata();
  if (
    !["webp", "png"].includes(source.format) ||
    !source.width ||
    !source.height
  )
    throw new Error(`Invalid artwork source: ${kind}:${variant}`);
  const encoded = await sharp(input)
    .resize({
      width: policy.width,
      height: policy.height,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85, alphaQuality: 100, effort: 4 })
    .toBuffer();
  const fits =
    source.width <= policy.width &&
    (!policy.height || source.height <= policy.height);
  // Avoid increasing small, already clean WebPs merely to re-encode them.
  const output =
    source.format === "webp" &&
    fits &&
    !source.exif &&
    !source.xmp &&
    !source.icc &&
    input.length <= encoded.length
      ? input
      : encoded;
  const metadata = await sharp(output).metadata();
  return {
    bytes: output,
    fields: {
      encoding: policy.id,
      source_sha256: sha256(input),
      source_byte_count: input.length,
      source_width: source.width,
      source_height: source.height,
      source_format: source.format,
      sha256: sha256(output),
      byte_count: output.length,
      width: metadata.width,
      height: metadata.height,
    },
  };
}

export async function validateEncodedArtwork(entry, bytes) {
  const policy = artworkEncodingPolicy(entry.kind, entry.variant);
  const metadata = await sharp(bytes).metadata();
  if (
    entry.encoding !== policy.id ||
    metadata.format !== "webp" ||
    metadata.width !== entry.width ||
    metadata.height !== entry.height ||
    metadata.width > policy.width ||
    (policy.height && metadata.height > policy.height) ||
    metadata.exif ||
    metadata.xmp ||
    metadata.icc ||
    sha256(bytes) !== entry.sha256 ||
    bytes.length !== entry.byte_count ||
    !/^[a-f0-9]{64}$/.test(entry.source_sha256) ||
    !(entry.source_byte_count > 0) ||
    !(entry.source_width >= entry.width) ||
    !(entry.source_height >= entry.height)
  )
    throw new Error(`Invalid optimized artwork: ${entry.kind}:${entry.id}`);
}
