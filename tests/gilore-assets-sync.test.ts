import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error The executable Node validator intentionally remains plain ESM.
import * as assetSync from "../scripts/sync-hsr-assets.mjs";

interface AssetManifestFixture {
  asset_schema_version: string;
  assets: Array<{
    dimensions: { height: number; width: number };
    entity_id: string;
    local_path: string;
    logical_kind: string;
    sha256: string;
    upstream_path: string;
  }>;
  coverage: {
    character: { mapped_entity_count: number };
  } & Record<string, { mapped_entity_count: number }>;
  files: Record<string, { byte_size: number; sha256: string }>;
  excluded_assets: Array<{
    entity_id: string;
    logical_kind: string;
    reason: string;
  }>;
  publication_contract: string;
  snapshot_id: string;
  validation_only_entity_ids: { achievement: string[] };
}

const generatedManifestPath = path.resolve(
  "public/assets/ggstarrail/cache/gilore/v1/assets-manifest.json"
);
const generatedAssetDirectory = path.dirname(generatedManifestPath);
const generatedReferenceManifestPath = path.resolve(
  "src/generated/hsr-reference/manifest.json"
);

function readManifest(): AssetManifestFixture {
  return JSON.parse(
    fs.readFileSync(generatedManifestPath, "utf8")
  ) as AssetManifestFixture;
}

function cloneManifest(): AssetManifestFixture {
  return structuredClone(readManifest());
}

function pngHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe("GIlore asset sync regressions", () => {
  it("accepts the complete audited manifest and deterministic runtime lookup", () => {
    const validated = assetSync.validateAssetManifestDocument(readManifest());
    const validatedWithDigest = {
      ...validated,
      manifestSha256: createHash("sha256")
        .update(fs.readFileSync(generatedManifestPath))
        .digest("hex"),
    };
    const lookup = assetSync.createRuntimeLookup(validatedWithDigest);

    expect(validated.assets).toHaveLength(578);
    expect(validated.assetPaths.size).toBe(551);
    expect(lookup.entries).toContainEqual(["achievement-category", "1", null]);
    expect(lookup.entries).toContainEqual([
      "achievement-reward",
      "1",
      expect.stringContaining(
        "55fe37d5cd4bca96d9da243469a4f2dd0d948833a57628a53eadc0c6d12cf1a9.png"
      ),
    ]);
    expect(lookup.entries).toContainEqual([
      "property",
      "StanceBreakAddedRatio",
      null,
    ]);
    expect(lookup.entries).toContainEqual(["relic-slot", "HEAD", null]);
    expect(() =>
      assetSync.validateRuntimeLookupDocument(lookup, validatedWithDigest)
    ).not.toThrow();
  });

  it("locks validation-only achievement IDs and explicit category gaps", () => {
    const invalidAchievementId = cloneManifest();
    invalidAchievementId.validation_only_entity_ids.achievement[0] = "0";
    expect(() =>
      assetSync.validateAssetManifestDocument(invalidAchievementId)
    ).toThrow("not a canonical positive u32 ID");

    const categoryGapDrift = cloneManifest();
    const categoryGap = categoryGapDrift.excluded_assets.find(
      (entry) => entry.logical_kind === "achievement_category"
    );
    if (!categoryGap) throw new Error("fixture has no category gap");
    categoryGap.reason = "guessed_generic_icon";
    expect(() =>
      assetSync.validateAssetManifestDocument(categoryGapDrift)
    ).toThrow("does not match the audited exclusion");
  });

  it("locks the source-backed Stellar Jade reward icon", () => {
    const manifest = cloneManifest();
    const reward = manifest.assets.find(
      (asset) => asset.logical_kind === "achievement_reward"
    );
    if (!reward) throw new Error("fixture has no achievement reward asset");
    reward.upstream_path = "icon/item/guessed.png";
    expect(() => assetSync.validateAssetManifestDocument(manifest)).toThrow(
      "Stellar Jade achievement reward asset drift"
    );
  });

  it("rejects unsupported asset schemas and incomplete coverage", () => {
    const unsupported = cloneManifest();
    unsupported.asset_schema_version = "2.0.0";
    expect(() => assetSync.validateAssetManifestDocument(unsupported)).toThrow(
      "unsupported asset schema"
    );

    const incomplete = cloneManifest();
    incomplete.coverage.character.mapped_entity_count = 92;
    expect(() => assetSync.validateAssetManifestDocument(incomplete)).toThrow(
      "mapped_entity_count mismatch"
    );

    const unknownField = cloneManifest() as AssetManifestFixture & {
      unexpected?: boolean;
    };
    unknownField.unexpected = true;
    expect(() => assetSync.validateAssetManifestDocument(unknownField)).toThrow(
      "manifest keys differ"
    );

    const revisionDrift = cloneManifest() as AssetManifestFixture & {
      reference: { source_revision: string };
    };
    revisionDrift.reference.source_revision = "f".repeat(40);
    expect(() =>
      assetSync.validateAssetManifestDocument(revisionDrift)
    ).toThrow("linked reference revision mismatch");
  });

  it("rejects an asset bundle linked to different reference bytes", async () => {
    const temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "ggstarrail-asset-reference-")
    );
    const driftedReference = path.join(temporaryRoot, "manifest.json");
    try {
      fs.writeFileSync(
        driftedReference,
        Buffer.concat([
          fs.readFileSync(generatedReferenceManifestPath),
          Buffer.from(" "),
        ])
      );
      await expect(
        assetSync.validateAssetDirectory(
          generatedAssetDirectory,
          driftedReference
        )
      ).rejects.toThrow("linked reference manifest digest mismatch");
    } finally {
      fs.rmSync(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("rejects traversal in content-addressed local paths", () => {
    const manifest = cloneManifest();
    const firstAsset = manifest.assets[0];
    if (!firstAsset) throw new Error("Fixture has no assets");
    firstAsset.local_path = "../outside.png";
    expect(() => assetSync.validateAssetManifestDocument(manifest)).toThrow(
      "traverses a parent directory"
    );
  });

  it("rejects publication-contract and recomputed snapshot identity drift", () => {
    const publicationDrift = cloneManifest();
    publicationDrift.publication_contract = "replace files whenever convenient";
    expect(() =>
      assetSync.validateAssetManifestDocument(publicationDrift)
    ).toThrow("asset publication contract drift");

    const snapshotDrift = cloneManifest();
    const previousSnapshotId = snapshotDrift.snapshot_id;
    snapshotDrift.snapshot_id = "f".repeat(64);
    snapshotDrift.files = Object.fromEntries(
      Object.entries(snapshotDrift.files).map(([filePath, metadata]) => [
        filePath.replace(previousSnapshotId, snapshotDrift.snapshot_id),
        metadata,
      ])
    );
    for (const asset of snapshotDrift.assets) {
      asset.local_path = asset.local_path.replace(
        previousSnapshotId,
        snapshotDrift.snapshot_id
      );
    }
    expect(() =>
      assetSync.validateAssetManifestDocument(snapshotDrift)
    ).toThrow("snapshot_id does not identify");
  });

  it("rejects PNG hash, byte-size, signature, and dimension drift", () => {
    const bytes = pngHeader(128, 256);
    const metadata = {
      byte_size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    expect(() =>
      assetSync.validateAssetFileBytes(
        bytes,
        metadata,
        { width: 128, height: 256 },
        "x"
      )
    ).not.toThrow();
    expect(() =>
      assetSync.validateAssetFileBytes(
        bytes,
        { ...metadata, byte_size: metadata.byte_size + 1 },
        { width: 128, height: 256 },
        "x"
      )
    ).toThrow("byte size mismatch");
    expect(() =>
      assetSync.validateAssetFileBytes(
        bytes,
        { ...metadata, sha256: "f".repeat(64) },
        { width: 128, height: 256 },
        "x"
      )
    ).toThrow("digest mismatch");
    expect(() =>
      assetSync.validateAssetFileBytes(
        bytes,
        metadata,
        { width: 1, height: 256 },
        "x"
      )
    ).toThrow("dimensions mismatch");

    const invalidSignature = Buffer.from(bytes);
    invalidSignature[0] = 0;
    const invalidMetadata = {
      byte_size: invalidSignature.length,
      sha256: createHash("sha256").update(invalidSignature).digest("hex"),
    };
    expect(() =>
      assetSync.validateAssetFileBytes(
        invalidSignature,
        invalidMetadata,
        { width: 128, height: 256 },
        "x"
      )
    ).toThrow("invalid PNG signature");
  });

  it("rejects a sidecar that does not authenticate the manifest bytes", () => {
    const bytes = Buffer.from("{}\n");
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(
      assetSync.validateManifestSidecar(
        Buffer.from(`${digest}  assets-manifest.json\n`),
        bytes
      )
    ).toBe(digest);
    expect(() =>
      assetSync.validateManifestSidecar(
        Buffer.from(`${"0".repeat(64)}  assets-manifest.json\n`),
        bytes
      )
    ).toThrow("sidecar digest mismatch");
  });

  it("never mutates an existing cache when source validation fails", async () => {
    const temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "ggstarrail-asset-publication-")
    );
    const sourceDirectory = path.join(temporaryRoot, "invalid-source");
    const cacheDirectory = path.join(temporaryRoot, "cache", "v1");
    const lookupDirectory = path.join(temporaryRoot, "cache", "lookup-v1");
    const cacheSentinel = path.join(cacheDirectory, "keep.txt");
    const lookupSentinel = path.join(lookupDirectory, "keep.txt");
    try {
      fs.mkdirSync(sourceDirectory, { recursive: true });
      fs.mkdirSync(cacheDirectory, { recursive: true });
      fs.mkdirSync(lookupDirectory, { recursive: true });
      fs.writeFileSync(cacheSentinel, "previous cache");
      fs.writeFileSync(lookupSentinel, "previous lookup");

      await expect(
        assetSync.syncAssetBundle(
          sourceDirectory,
          cacheDirectory,
          lookupDirectory,
          generatedReferenceManifestPath
        )
      ).rejects.toThrow();
      expect(fs.readFileSync(cacheSentinel, "utf8")).toBe("previous cache");
      expect(fs.readFileSync(lookupSentinel, "utf8")).toBe("previous lookup");
    } finally {
      fs.rmSync(temporaryRoot, { force: true, recursive: true });
    }
  });
});
