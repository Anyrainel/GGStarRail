import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SUPPORTED_ASSET_SCHEMA_VERSION = "1.0.0";
export const SUPPORTED_REFERENCE_SCHEMA_VERSION = "1.1.0";
export const AUDITED_REFERENCE_REVISION =
  "014e33e2404f8cd668bf06fc2ea6db53b6bc3992";
export const AUDITED_ASSET_SOURCE_REVISION =
  "d226befe3db13f2ec15f4161d5f34b1b607643fe";

export const EXPECTED_ASSET_COVERAGE = Object.freeze({
  character: Object.freeze({
    reference_entity_count: 93,
    eligible_entity_count: 93,
    mapped_entity_count: 93,
    logical_asset_count: 93,
    excluded_entity_count: 0,
  }),
  combat_type: Object.freeze({
    reference_entity_count: 7,
    eligible_entity_count: 7,
    mapped_entity_count: 7,
    logical_asset_count: 7,
    excluded_entity_count: 0,
  }),
  light_cone: Object.freeze({
    reference_entity_count: 169,
    eligible_entity_count: 169,
    mapped_entity_count: 169,
    logical_asset_count: 169,
    excluded_entity_count: 0,
  }),
  path: Object.freeze({
    reference_entity_count: 9,
    eligible_entity_count: 9,
    mapped_entity_count: 9,
    logical_asset_count: 9,
    excluded_entity_count: 0,
  }),
  property: Object.freeze({
    reference_entity_count: 56,
    eligible_entity_count: 55,
    mapped_entity_count: 55,
    logical_asset_count: 55,
    excluded_entity_count: 1,
  }),
  relic_piece: Object.freeze({
    reference_entity_count: 742,
    eligible_entity_count: 742,
    mapped_entity_count: 742,
    logical_asset_count: 184,
    excluded_entity_count: 0,
  }),
  relic_set: Object.freeze({
    reference_entity_count: 60,
    eligible_entity_count: 60,
    mapped_entity_count: 60,
    logical_asset_count: 60,
    excluded_entity_count: 0,
  }),
});

const ASSET_KINDS = Object.freeze(Object.keys(EXPECTED_ASSET_COVERAGE));
const EXPECTED_MAPPING_CONTRACT =
  "Join locale-independent reference IDs only through pinned StarRailRes index JSON; TurnBasedGameData SpriteOutput paths are provenance and are never filename inputs. Unknown additive reference entity fields are ignored.";
const EXPECTED_PUBLICATION_CONTRACT =
  "Files are committed as an immutable snapshot before assets-manifest.json is atomically replaced as the live commit marker. assets-manifest.sha256 is advisory; on a mismatch, reread both files and retry.";
const EXPECTED_INDEX_PATHS = Object.freeze({
  characters: "index_min/en/characters.json",
  combat_types: "index_min/en/elements.json",
  light_cones: "index_min/en/light_cones.json",
  paths: "index_min/en/paths.json",
  properties: "index_min/en/properties.json",
  relic_sets: "index_min/en/relic_sets.json",
  relics: "index_min/en/relics.json",
});
const EXPECTED_SOURCE_INDEX_EXTRAS = Object.freeze({
  character: Object.freeze(["1014", "1015", "1508", "1509"]),
  combat_type: Object.freeze([]),
  light_cone: Object.freeze([]),
  path: Object.freeze([]),
  property: Object.freeze(["AllDamageTypeAddedRatio", "SpeedAddedRatio"]),
  relic_piece: Object.freeze([]),
  relic_set: Object.freeze([]),
});
const EXPECTED_OUTPUT_DOCUMENTS = Object.freeze([
  "ATTRIBUTION.md",
  "upstream/LICENSE",
  "upstream/README.md",
]);
const EXPECTED_RELIC_SLOTS = Object.freeze([
  "BODY",
  "FOOT",
  "HAND",
  "HEAD",
  "NECK",
  "OBJECT",
]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
export const DEFAULT_ASSET_SOURCE_DIRECTORY = path.resolve(
  repositoryRoot,
  "..",
  "GIlore",
  "data",
  "reference",
  "honkai_star_rail",
  "assets",
  "v1"
);
export const DEFAULT_ASSET_CACHE_DIRECTORY = path.resolve(
  repositoryRoot,
  "public",
  "assets",
  "ggstarrail",
  "cache",
  "gilore",
  "v1"
);
export const DEFAULT_ASSET_LOOKUP_DIRECTORY = path.resolve(
  repositoryRoot,
  "public",
  "assets",
  "ggstarrail",
  "cache",
  "gilore",
  "lookup-v1"
);
export const DEFAULT_REFERENCE_MANIFEST_PATH = path.resolve(
  repositoryRoot,
  "src",
  "generated",
  "hsr-reference",
  "manifest.json"
);

function fail(message) {
  throw new Error(`HSR asset validation failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertObject(value, label) {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`
  );
  return value;
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
  return value;
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(assertObject(value, label)).sort();
  const sortedExpected = [...expected].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(sortedExpected),
    `${label} keys differ: expected ${sortedExpected.join(", ")}; got ${actual.join(", ")}`
  );
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} is empty`);
}

function assertPositiveInteger(value, label) {
  assert(Number.isInteger(value) && value > 0, `${label} must be positive`);
}

function assertSha256(value, label) {
  assert(
    typeof value === "string" && SHA256_PATTERN.test(value),
    `${label} must be a lowercase SHA-256 digest`
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

export function assertSafeRelativePath(relativePath, label = "path") {
  assertNonEmptyString(relativePath, label);
  assert(!relativePath.includes("\\"), `${label} must use forward slashes`);
  assert(!relativePath.includes("\0"), `${label} contains a null byte`);
  assert(!path.posix.isAbsolute(relativePath), `${label} must be relative`);
  assert(!/^[a-z][a-z\d+.-]*:/i.test(relativePath), `${label} is not local`);
  const segments = relativePath.split("/");
  assert(
    segments.every((segment) => segment !== "" && segment !== "."),
    `${label} is not normalized`
  );
  assert(!segments.includes(".."), `${label} traverses a parent directory`);
  assert(
    path.posix.normalize(relativePath) === relativePath,
    `${label} is not normalized`
  );
}

function resolveContainedPath(rootDirectory, relativePath, label) {
  assertSafeRelativePath(relativePath, label);
  const root = path.resolve(rootDirectory);
  const resolved = path.resolve(root, ...relativePath.split("/"));
  const relation = path.relative(root, resolved);
  assert(
    relation !== ".." && !relation.startsWith(`..${path.sep}`),
    `${label} escapes its root`
  );
  return resolved;
}

export function validateManifestSidecar(sidecarBytes, manifestBytes) {
  const text = sidecarBytes.toString("utf8");
  const match = /^([a-f0-9]{64}) {2}assets-manifest\.json\r?\n?$/.exec(text);
  assert(match, "assets-manifest.sha256 has an invalid format");
  const actual = sha256(manifestBytes);
  assert(
    match[1] === actual,
    `assets-manifest.json sidecar digest mismatch: expected ${match[1]}; got ${actual}`
  );
  return actual;
}

async function readCommittedManifest(root) {
  const manifestPath = path.join(root, "assets-manifest.json");
  const sidecarPath = path.join(root, "assets-manifest.sha256");
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const sidecarBytes = await readFile(sidecarPath);
      const manifestBytes = await readFile(manifestPath);
      return {
        manifestBytes,
        manifestSha256: validateManifestSidecar(sidecarBytes, manifestBytes),
        sidecarBytes,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function readPngDimensions(bytes, label = "PNG") {
  assert(bytes.length >= 24, `${label} is shorter than a PNG header`);
  assert(
    bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
    `${label} has an invalid PNG signature`
  );
  assert(bytes.readUInt32BE(8) === 13, `${label} has an invalid IHDR length`);
  assert(bytes.toString("ascii", 12, 16) === "IHDR", `${label} lacks IHDR`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assertPositiveInteger(width, `${label} width`);
  assertPositiveInteger(height, `${label} height`);
  return { width, height };
}

export function validateAssetFileBytes(bytes, metadata, dimensions, label) {
  const file = assertObject(metadata, `${label} metadata`);
  assertExactKeys(file, ["byte_size", "sha256"], `${label} metadata`);
  assertPositiveInteger(file.byte_size, `${label}.byte_size`);
  assertSha256(file.sha256, `${label}.sha256`);
  assert(
    bytes.length === file.byte_size,
    `${label} byte size mismatch: expected ${file.byte_size}; got ${bytes.length}`
  );
  const digest = sha256(bytes);
  assert(
    digest === file.sha256,
    `${label} digest mismatch: expected ${file.sha256}; got ${digest}`
  );
  if (dimensions) {
    const actual = readPngDimensions(bytes, label);
    assert(
      actual.width === dimensions.width && actual.height === dimensions.height,
      `${label} dimensions mismatch: expected ${dimensions.width}x${dimensions.height}; got ${actual.width}x${actual.height}`
    );
  }
}

function validateFileMetadata(value, label) {
  const metadata = assertObject(value, label);
  assertExactKeys(metadata, ["byte_size", "sha256"], label);
  assertPositiveInteger(metadata.byte_size, `${label}.byte_size`);
  assertSha256(metadata.sha256, `${label}.sha256`);
  return metadata;
}

function validateReferenceLink(reference) {
  const value = assertObject(reference, "manifest.reference");
  assertExactKeys(
    value,
    [
      "bundle_id",
      "manifest_path",
      "manifest_sha256",
      "schema_version",
      "source_revision",
    ],
    "manifest.reference"
  );
  assert(value.bundle_id === "ggstarrail-reference", "unexpected reference ID");
  assert(value.manifest_path === "manifest.json", "unexpected reference path");
  assert(
    value.schema_version === SUPPORTED_REFERENCE_SCHEMA_VERSION,
    "unsupported linked reference schema"
  );
  assert(
    value.source_revision === AUDITED_REFERENCE_REVISION,
    "linked reference revision mismatch"
  );
  assertSha256(value.manifest_sha256, "manifest.reference.manifest_sha256");
  return value;
}

function validateAssetSource(source) {
  const value = assertObject(source, "manifest.source");
  assertExactKeys(
    value,
    [
      "attribution",
      "commit_time",
      "commit_title",
      "index_locale",
      "index_paths",
      "license_scope",
      "project",
      "public_redistribution",
      "remote_url",
      "repository_license",
      "revision",
      "source_files",
      "source_id",
    ],
    "manifest.source"
  );
  assert(value.source_id === "star_rail_res", "unexpected asset source ID");
  assert(value.project === "Mar-7th/StarRailRes", "unexpected asset project");
  assert(
    value.remote_url === "https://github.com/Mar-7th/StarRailRes.git",
    "unexpected asset source remote"
  );
  assert(
    value.revision === AUDITED_ASSET_SOURCE_REVISION,
    "asset source revision mismatch"
  );
  assert(value.index_locale === "en", "asset source index locale drift");
  assert(
    value.repository_license === "AGPL-3.0",
    "asset repository license metadata drift"
  );
  assert(
    value.public_redistribution === "not_cleared",
    "game-art redistribution must remain explicitly uncleared"
  );
  assertNonEmptyString(value.commit_time, "manifest.source.commit_time");
  assertNonEmptyString(value.commit_title, "manifest.source.commit_title");
  assertNonEmptyString(value.license_scope, "manifest.source.license_scope");
  assertNonEmptyString(value.attribution, "manifest.source.attribution");
  assert(
    value.license_scope.includes("does not establish rights"),
    "asset license scope must distinguish repository code from game art"
  );

  assertExactKeys(
    value.index_paths,
    Object.keys(EXPECTED_INDEX_PATHS),
    "manifest.source.index_paths"
  );
  for (const [key, expected] of Object.entries(EXPECTED_INDEX_PATHS)) {
    assert(
      value.index_paths[key] === expected,
      `manifest.source.index_paths.${key} drift`
    );
  }

  const expectedSourceFiles = [
    "LICENSE",
    "README.md",
    ...Object.values(EXPECTED_INDEX_PATHS),
  ];
  assertExactKeys(
    value.source_files,
    expectedSourceFiles,
    "manifest.source.source_files"
  );
  for (const [filePath, metadata] of Object.entries(value.source_files)) {
    assertSafeRelativePath(
      filePath,
      `manifest.source.source_files.${filePath}`
    );
    validateFileMetadata(metadata, `manifest.source.source_files.${filePath}`);
  }
  return value;
}

function validateCoverage(coverage) {
  const value = assertObject(coverage, "manifest.coverage");
  assertExactKeys(value, ASSET_KINDS, "manifest.coverage");
  for (const [kind, expected] of Object.entries(EXPECTED_ASSET_COVERAGE)) {
    const entry = assertObject(value[kind], `manifest.coverage.${kind}`);
    assertExactKeys(
      entry,
      [
        "eligible_entity_count",
        "excluded_entity_count",
        "logical_asset_count",
        "mapped_entity_count",
        "reference_entity_count",
      ],
      `manifest.coverage.${kind}`
    );
    for (const [field, count] of Object.entries(expected)) {
      assert(
        entry[field] === count,
        `manifest.coverage.${kind}.${field} mismatch: expected ${count}; got ${entry[field]}`
      );
    }
    assert(
      entry.reference_entity_count ===
        entry.eligible_entity_count + entry.excluded_entity_count,
      `manifest.coverage.${kind} does not account for every reference entity`
    );
    assert(
      entry.mapped_entity_count === entry.eligible_entity_count,
      `manifest.coverage.${kind} has unmapped eligible entities`
    );
  }
  return value;
}

function validateExcludedAssets(excludedAssets) {
  const entries = assertArray(excludedAssets, "manifest.excluded_assets");
  assert(entries.length === 1, "expected exactly one explicit asset exclusion");
  const entry = assertObject(entries[0], "manifest.excluded_assets[0]");
  assertExactKeys(
    entry,
    ["entity_id", "logical_kind", "reason"],
    "manifest.excluded_assets[0]"
  );
  assert(
    entry.logical_kind === "property" &&
      entry.entity_id === "StanceBreakAddedRatio" &&
      entry.reason === "no_real_upstream_icon",
    "unexpected asset exclusion"
  );
}

function validateSourceIndexExtras(extras) {
  const value = assertObject(extras, "manifest.source_index_extras");
  assertExactKeys(value, ASSET_KINDS, "manifest.source_index_extras");
  for (const [kind, expected] of Object.entries(EXPECTED_SOURCE_INDEX_EXTRAS)) {
    const entries = assertArray(
      value[kind],
      `manifest.source_index_extras.${kind}`
    );
    assert(
      entries.every((entry) => typeof entry === "string" && entry.length > 0),
      `manifest.source_index_extras.${kind} contains an invalid ID`
    );
    assert(
      JSON.stringify(entries) === JSON.stringify(expected),
      `manifest.source_index_extras.${kind} drift`
    );
  }
}

function validateAssetRecord(record, index, sourceRevision, snapshotId) {
  const label = `manifest.assets[${index}]`;
  const value = assertObject(record, label);
  assertExactKeys(
    value,
    [
      "byte_size",
      "dimensions",
      "entity_id",
      "local_path",
      "logical_kind",
      "media_type",
      "sha256",
      "upstream_path",
      "upstream_revision",
      "variant_entity_ids",
    ],
    label
  );
  assert(ASSET_KINDS.includes(value.logical_kind), `${label} has unknown kind`);
  assertNonEmptyString(value.entity_id, `${label}.entity_id`);
  assertSafeRelativePath(value.upstream_path, `${label}.upstream_path`);
  assertSafeRelativePath(value.local_path, `${label}.local_path`);
  assert(
    value.upstream_revision === sourceRevision,
    `${label}.upstream_revision mismatch`
  );
  assert(value.media_type === "image/png", `${label} is not image/png`);
  assertSha256(value.sha256, `${label}.sha256`);
  assertPositiveInteger(value.byte_size, `${label}.byte_size`);
  assert(
    value.local_path ===
      `snapshots/${snapshotId}/blobs/sha256/${value.sha256}.png`,
    `${label}.local_path is not content-addressed by its digest`
  );
  const dimensions = assertObject(value.dimensions, `${label}.dimensions`);
  assertExactKeys(dimensions, ["height", "width"], `${label}.dimensions`);
  assertPositiveInteger(dimensions.width, `${label}.dimensions.width`);
  assertPositiveInteger(dimensions.height, `${label}.dimensions.height`);
  const variants = assertArray(value.variant_entity_ids, `${label}.variants`);
  assert(variants.length > 0, `${label} has no variant IDs`);
  const uniqueVariants = new Set();
  for (const variant of variants) {
    assertNonEmptyString(variant, `${label}.variant_entity_ids`);
    assert(!uniqueVariants.has(variant), `${label} repeats variant ${variant}`);
    uniqueVariants.add(variant);
  }
  return value;
}

export function validateAssetManifestDocument(manifest) {
  const value = assertObject(manifest, "manifest");
  assertExactKeys(
    value,
    [
      "asset_schema_version",
      "assets",
      "coverage",
      "excluded_assets",
      "files",
      "game_id",
      "manifest_id",
      "mapping_contract",
      "publication_contract",
      "reference",
      "snapshot_id",
      "source",
      "source_index_extras",
    ],
    "manifest"
  );
  assert(value.manifest_id === "ggstarrail-assets", "unexpected manifest ID");
  assert(value.game_id === "honkai_star_rail", "unexpected asset game ID");
  assert(
    value.asset_schema_version === SUPPORTED_ASSET_SCHEMA_VERSION,
    `unsupported asset schema ${value.asset_schema_version}`
  );
  assert(
    value.mapping_contract === EXPECTED_MAPPING_CONTRACT,
    "asset mapping contract drift"
  );
  assertSha256(value.snapshot_id, "manifest.snapshot_id");
  assert(
    value.publication_contract === EXPECTED_PUBLICATION_CONTRACT,
    "asset publication contract drift"
  );
  const reference = validateReferenceLink(value.reference);
  const source = validateAssetSource(value.source);
  const coverage = validateCoverage(value.coverage);
  validateExcludedAssets(value.excluded_assets);
  validateSourceIndexExtras(value.source_index_extras);

  const files = assertObject(value.files, "manifest.files");
  assertExactKeys(
    Object.fromEntries(
      Object.keys(files).map((filePath) => [filePath, files[filePath]])
    ),
    Object.keys(files),
    "manifest.files"
  );
  for (const [filePath, metadata] of Object.entries(files)) {
    assertSafeRelativePath(filePath, `manifest.files.${filePath}`);
    assert(
      filePath.startsWith(`snapshots/${value.snapshot_id}/`),
      `manifest.files.${filePath} is outside the immutable snapshot`
    );
    validateFileMetadata(metadata, `manifest.files.${filePath}`);
  }

  const snapshotFiles = Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((filePath) => [
        filePath.slice(`snapshots/${value.snapshot_id}/`.length),
        files[filePath],
      ])
  );
  assert(
    sha256(Buffer.from(stableJson(snapshotFiles), "utf8")) ===
      value.snapshot_id,
    "manifest.snapshot_id does not identify the declared immutable files"
  );

  const assets = assertArray(value.assets, "manifest.assets").map(
    (record, index) =>
      validateAssetRecord(record, index, source.revision, value.snapshot_id)
  );
  const entityIdsByKind = new Map(ASSET_KINDS.map((kind) => [kind, new Set()]));
  const variantIdsByKind = new Map(
    ASSET_KINDS.map((kind) => [kind, new Set()])
  );
  const assetPaths = new Map();
  for (const asset of assets) {
    const entityIds = entityIdsByKind.get(asset.logical_kind);
    assert(
      !entityIds.has(asset.entity_id),
      `duplicate ${asset.logical_kind} logical asset ${asset.entity_id}`
    );
    entityIds.add(asset.entity_id);
    const variantIds = variantIdsByKind.get(asset.logical_kind);
    for (const variantId of asset.variant_entity_ids) {
      assert(
        !variantIds.has(variantId),
        `duplicate ${asset.logical_kind} variant ${variantId}`
      );
      variantIds.add(variantId);
    }
    const prior = assetPaths.get(asset.local_path);
    if (prior) {
      assert(
        prior.sha256 === asset.sha256 &&
          prior.byte_size === asset.byte_size &&
          prior.dimensions.width === asset.dimensions.width &&
          prior.dimensions.height === asset.dimensions.height,
        `shared asset path ${asset.local_path} has conflicting metadata`
      );
    } else {
      assetPaths.set(asset.local_path, asset);
    }
    const metadata = files[asset.local_path];
    assert(metadata, `${asset.local_path} is absent from manifest.files`);
    assert(
      metadata.sha256 === asset.sha256 &&
        metadata.byte_size === asset.byte_size,
      `${asset.local_path} file metadata differs from its asset record`
    );
  }

  for (const kind of ASSET_KINDS) {
    assert(
      entityIdsByKind.get(kind).size === coverage[kind].logical_asset_count,
      `${kind} logical asset count does not match coverage`
    );
    assert(
      variantIdsByKind.get(kind).size === coverage[kind].mapped_entity_count,
      `${kind} mapped variant count does not match coverage`
    );
  }
  assert(
    assets.length === 577,
    `expected 577 logical assets; got ${assets.length}`
  );
  assert(
    assetPaths.size === 550,
    `expected 550 unique asset blobs; got ${assetPaths.size}`
  );
  const pngFiles = Object.keys(files).filter((filePath) =>
    filePath.endsWith(".png")
  );
  const documentFiles = Object.keys(files).filter(
    (filePath) => !filePath.endsWith(".png")
  );
  assert(
    pngFiles.length === 550,
    `expected 550 PNG files; got ${pngFiles.length}`
  );
  assert(
    JSON.stringify(documentFiles.sort()) ===
      JSON.stringify(
        EXPECTED_OUTPUT_DOCUMENTS.map(
          (filePath) => `snapshots/${value.snapshot_id}/${filePath}`
        ).sort()
      ),
    "asset output attribution documents drift"
  );
  assert(
    pngFiles.every((filePath) => assetPaths.has(filePath)),
    "manifest.files contains an unreferenced PNG"
  );
  assert(Object.keys(files).length === 553, "asset output file count drift");
  assert(
    files[`snapshots/${value.snapshot_id}/upstream/LICENSE`].sha256 ===
      source.source_files.LICENSE.sha256 &&
      files[`snapshots/${value.snapshot_id}/upstream/LICENSE`].byte_size ===
        source.source_files.LICENSE.byte_size,
    "copied upstream LICENSE metadata drift"
  );
  assert(
    files[`snapshots/${value.snapshot_id}/upstream/README.md`].sha256 ===
      source.source_files["README.md"].sha256 &&
      files[`snapshots/${value.snapshot_id}/upstream/README.md`].byte_size ===
        source.source_files["README.md"].byte_size,
    "copied upstream README metadata drift"
  );
  return { assets, assetPaths, coverage, files, manifest: value, reference };
}

async function listRelativeFiles(directory, rootDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path
      .relative(rootDirectory, absolute)
      .split(path.sep)
      .join("/");
    if (entry.isSymbolicLink()) fail(`${relative} must not be a symbolic link`);
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(absolute, rootDirectory)));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      fail(`${relative} is not a regular file`);
    }
  }
  return files;
}

async function validateLinkedReference(reference, referenceManifestPath) {
  const bytes = await readFile(referenceManifestPath);
  const digest = sha256(bytes);
  assert(
    digest === reference.manifest_sha256,
    `linked reference manifest digest mismatch: expected ${reference.manifest_sha256}; got ${digest}`
  );
  const manifest = assertObject(
    parseJson(bytes, referenceManifestPath),
    "linked reference manifest"
  );
  assert(
    manifest.bundle_id === reference.bundle_id,
    "linked reference bundle ID mismatch"
  );
  assert(
    manifest.schema_version === reference.schema_version,
    "linked reference schema mismatch"
  );
  const source = assertObject(manifest.source, "linked reference source");
  assert(
    source.revision === reference.source_revision,
    "linked reference source revision mismatch"
  );
}

export async function validateAssetDirectory(
  directory,
  referenceManifestPath = DEFAULT_REFERENCE_MANIFEST_PATH,
  options = {}
) {
  const root = path.resolve(directory);
  const manifestPath = path.join(root, "assets-manifest.json");
  const { manifestBytes, manifestSha256, sidecarBytes } =
    await readCommittedManifest(root);
  const validated = validateAssetManifestDocument(
    parseJson(manifestBytes, manifestPath)
  );
  await validateLinkedReference(validated.reference, referenceManifestPath);

  const dimensionsByPath = new Map();
  for (const asset of validated.assets) {
    dimensionsByPath.set(asset.local_path, asset.dimensions);
  }
  for (const [filePath, metadata] of Object.entries(validated.files)) {
    const absolute = resolveContainedPath(root, filePath, filePath);
    const info = await lstat(absolute);
    assert(info.isFile(), `${filePath} is not a regular file`);
    const bytes = await readFile(absolute);
    validateAssetFileBytes(
      bytes,
      metadata,
      dimensionsByPath.get(filePath) ?? null,
      filePath
    );
  }

  if (!options.allowUnlistedFiles) {
    const actualFiles = (await listRelativeFiles(root)).sort();
    const expectedFiles = [
      ...Object.keys(validated.files),
      "assets-manifest.json",
      "assets-manifest.sha256",
    ].sort();
    assert(
      JSON.stringify(actualFiles) === JSON.stringify(expectedFiles),
      "asset directory contains missing or unexpected files"
    );
  }
  return { ...validated, manifestBytes, manifestSha256, sidecarBytes };
}

function runtimeKind(kind) {
  return kind.replaceAll("_", "-");
}

export function createRuntimeLookup(validated) {
  const entriesByKey = new Map();
  for (const asset of validated.assets) {
    const kind = runtimeKind(asset.logical_kind);
    const cachePath = `cache/gilore/v1/${asset.local_path}`;
    for (const id of new Set([asset.entity_id, ...asset.variant_entity_ids])) {
      const key = `${kind}\0${id}`;
      const existing = entriesByKey.get(key);
      assert(
        !existing || existing[2] === cachePath,
        `runtime lookup has conflicting mapping for ${kind}:${id}`
      );
      entriesByKey.set(key, [kind, id, cachePath]);
    }
  }
  entriesByKey.set("property\0StanceBreakAddedRatio", [
    "property",
    "StanceBreakAddedRatio",
    null,
  ]);
  for (const slot of EXPECTED_RELIC_SLOTS) {
    entriesByKey.set(`relic-slot\0${slot}`, ["relic-slot", slot, null]);
  }
  const entries = [...entriesByKey.values()].sort((left, right) => {
    const kindComparison = left[0].localeCompare(right[0]);
    return kindComparison || left[1].localeCompare(right[1]);
  });
  return {
    lookup_schema_version: "1",
    asset_manifest_sha256: validated.manifestSha256,
    reference_manifest_sha256: validated.reference.manifest_sha256,
    source_revision: validated.manifest.source.revision,
    entries,
  };
}

export function validateRuntimeLookupDocument(lookup, validated) {
  const value = assertObject(lookup, "runtime lookup");
  assertExactKeys(
    value,
    [
      "asset_manifest_sha256",
      "entries",
      "lookup_schema_version",
      "reference_manifest_sha256",
      "source_revision",
    ],
    "runtime lookup"
  );
  assert(value.lookup_schema_version === "1", "unsupported lookup schema");
  assert(
    value.asset_manifest_sha256 === validated.manifestSha256,
    "runtime lookup asset manifest digest mismatch"
  );
  assert(
    value.reference_manifest_sha256 === validated.reference.manifest_sha256,
    "runtime lookup reference digest mismatch"
  );
  assert(
    value.source_revision === validated.manifest.source.revision,
    "runtime lookup source revision mismatch"
  );
  const expected = createRuntimeLookup(validated);
  assert(
    JSON.stringify(value.entries) === JSON.stringify(expected.entries),
    "runtime lookup entries do not match the validated asset manifest"
  );
  return value;
}

async function copyValidatedAssetDirectory(validated, destination) {
  for (const filePath of Object.keys(validated.files).sort()) {
    const sourcePath = resolveContainedPath(
      validated.sourceDirectory,
      filePath,
      filePath
    );
    const destinationPath = resolveContainedPath(
      destination,
      filePath,
      filePath
    );
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }
  await writeFile(
    path.join(destination, "assets-manifest.sha256"),
    validated.sidecarBytes
  );
  // The complete asset manifest is the local-cache commit marker.
  await writeFile(
    path.join(destination, "assets-manifest.json"),
    validated.manifestBytes
  );
}

async function backupDirectory(directory, prefix) {
  if (!(await pathExists(directory))) return null;
  const parent = path.dirname(directory);
  const backupRoot = await mkdtemp(path.join(parent, prefix));
  const previous = path.join(backupRoot, "previous");
  try {
    await rename(directory, previous);
    return { previous, root: backupRoot };
  } catch (error) {
    await rm(backupRoot, { force: true, recursive: true });
    throw error;
  }
}

async function restorePublishedDirectory(directory, backup, published) {
  if (backup) {
    await rm(directory, { force: true, recursive: true });
    await rename(backup.previous, directory);
    await rm(backup.root, { force: true, recursive: true });
  } else if (published) {
    await rm(directory, { force: true, recursive: true });
  }
}

export async function validatePublishedAssets(
  cacheDirectory = DEFAULT_ASSET_CACHE_DIRECTORY,
  lookupDirectory = DEFAULT_ASSET_LOOKUP_DIRECTORY,
  referenceManifestPath = DEFAULT_REFERENCE_MANIFEST_PATH
) {
  const validated = await validateAssetDirectory(
    cacheDirectory,
    referenceManifestPath
  );
  const lookupPath = path.join(lookupDirectory, "runtime-lookup.json");
  const lookup = parseJson(await readFile(lookupPath), lookupPath);
  validateRuntimeLookupDocument(lookup, validated);
  return { ...validated, lookup };
}

export async function syncAssetBundle(
  sourceDirectory,
  cacheDirectory,
  lookupDirectory,
  referenceManifestPath = DEFAULT_REFERENCE_MANIFEST_PATH
) {
  const sourceRoot = path.resolve(sourceDirectory);
  const cacheRoot = path.resolve(cacheDirectory);
  const lookupRoot = path.resolve(lookupDirectory);
  for (const [label, output] of [
    ["cache", cacheRoot],
    ["lookup", lookupRoot],
  ]) {
    assert(
      output !== path.parse(output).root,
      `refusing to publish ${label} at a filesystem root`
    );
  }
  const validated = await validateAssetDirectory(
    sourceRoot,
    referenceManifestPath,
    { allowUnlistedFiles: true }
  );
  validated.sourceDirectory = sourceRoot;
  const runtimeLookup = createRuntimeLookup(validated);
  validateRuntimeLookupDocument(runtimeLookup, validated);

  await mkdir(path.dirname(cacheRoot), { recursive: true });
  await mkdir(path.dirname(lookupRoot), { recursive: true });
  let cacheStage = await mkdtemp(
    path.join(path.dirname(cacheRoot), ".hsr-assets-cache-stage-")
  );
  let lookupStage = await mkdtemp(
    path.join(path.dirname(lookupRoot), ".hsr-assets-lookup-stage-")
  );
  let cacheBackup = null;
  let lookupBackup = null;
  let cachePublished = false;
  let lookupPublished = false;
  try {
    await copyValidatedAssetDirectory(validated, cacheStage);
    await writeFile(
      path.join(lookupStage, "runtime-lookup.json"),
      stableJson(runtimeLookup),
      "utf8"
    );
    await validateAssetDirectory(cacheStage, referenceManifestPath);
    const stagedLookupPath = path.join(lookupStage, "runtime-lookup.json");
    validateRuntimeLookupDocument(
      parseJson(await readFile(stagedLookupPath), stagedLookupPath),
      validated
    );

    try {
      cacheBackup = await backupDirectory(
        cacheRoot,
        ".hsr-assets-cache-backup-"
      );
      lookupBackup = await backupDirectory(
        lookupRoot,
        ".hsr-assets-lookup-backup-"
      );
      await rename(cacheStage, cacheRoot);
      cacheStage = null;
      cachePublished = true;
      await rename(lookupStage, lookupRoot);
      lookupStage = null;
      lookupPublished = true;
      const published = await validatePublishedAssets(
        cacheRoot,
        lookupRoot,
        referenceManifestPath
      );
      if (cacheBackup)
        await rm(cacheBackup.root, { force: true, recursive: true });
      if (lookupBackup) {
        await rm(lookupBackup.root, { force: true, recursive: true });
      }
      cacheBackup = null;
      lookupBackup = null;
      return published;
    } catch (error) {
      await Promise.all([
        restorePublishedDirectory(cacheRoot, cacheBackup, cachePublished),
        restorePublishedDirectory(lookupRoot, lookupBackup, lookupPublished),
      ]);
      cacheBackup = null;
      lookupBackup = null;
      throw error;
    }
  } finally {
    if (cacheStage) await rm(cacheStage, { force: true, recursive: true });
    if (lookupStage) await rm(lookupStage, { force: true, recursive: true });
    // A rollback failure intentionally leaves its backup directory intact for
    // recovery instead of deleting the previous valid cache in this cleanup.
  }
}

function parseArguments(argv) {
  const options = {
    cacheOutput: DEFAULT_ASSET_CACHE_DIRECTORY,
    checkGenerated: false,
    lookupOutput: DEFAULT_ASSET_LOOKUP_DIRECTORY,
    reference: DEFAULT_REFERENCE_MANIFEST_PATH,
    source: DEFAULT_ASSET_SOURCE_DIRECTORY,
    verifyOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      argument === "--source" ||
      argument === "--cache-output" ||
      argument === "--lookup-output" ||
      argument === "--reference"
    ) {
      const value = argv[index + 1];
      assert(value, `${argument} requires a path`);
      const key = argument
        .slice(2)
        .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      options[key] = path.resolve(value);
      index += 1;
    } else if (argument === "--verify-only") {
      options.verifyOnly = true;
    } else if (argument === "--check-generated") {
      options.checkGenerated = true;
    } else {
      fail(`unknown argument ${argument}`);
    }
  }
  assert(
    !(options.verifyOnly && options.checkGenerated),
    "--verify-only and --check-generated cannot be combined"
  );
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = options.checkGenerated
    ? await validatePublishedAssets(
        options.cacheOutput,
        options.lookupOutput,
        options.reference
      )
    : options.verifyOnly
      ? await validateAssetDirectory(options.source, options.reference, {
          allowUnlistedFiles: true,
        })
      : await syncAssetBundle(
          options.source,
          options.cacheOutput,
          options.lookupOutput,
          options.reference
        );
  const operation = options.checkGenerated
    ? "Generated asset cache verified"
    : options.verifyOnly
      ? "Source asset bundle verified"
      : "Asset cache synchronized";
  process.stdout.write(
    `${operation}: ${result.manifestSha256}\n` +
      `Coverage: 93 Characters, 169 Light Cones, 60 sets, ` +
      `184 logical Relic pieces / 742 rarity variants, 55 properties + ` +
      `1 explicit fallback, 9 Paths, 7 combat types\n` +
      `Files: ${result.assets.length} logical mappings / ` +
      `${result.assetPaths.size} content-addressed PNGs\n`
  );
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
