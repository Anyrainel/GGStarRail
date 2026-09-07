import type {
  CatalogAssetKind,
  CatalogAssetLookupEntry,
} from "@/domain/assets";
import runtimeLookupUrl from "@/generated/hsr-assets/runtime-lookup.json?url";
import { configureCatalogAssetLookup } from "@/lib/assets";

const CATALOG_ASSET_KINDS = new Set<CatalogAssetKind>([
  "achievement",
  "achievement-category",
  "achievement-reward",
  "character",
  "light-cone",
  "relic-set",
  "relic-piece",
  "relic-slot",
  "path",
  "combat-type",
  "property",
]);

type RuntimeLookupTuple = readonly [
  kind: CatalogAssetKind,
  id: string,
  cachePath: string | null,
];

interface RuntimeLookupDocument {
  lookup_schema_version: "1";
  asset_manifest_sha256: string;
  reference_manifest_sha256: string;
  source_revision: string;
  entries: readonly RuntimeLookupTuple[];
}

let lookupPromise: Promise<void> | null = null;

const REQUIRED_FALLBACKS: readonly CatalogAssetLookupEntry[] = [
  ...Array.from({ length: 9 }, (_, index) => ({
    kind: "achievement-category" as const,
    id: String(index + 1),
    cachePath: null,
  })),
  { kind: "property", id: "StanceBreakAddedRatio", cachePath: null },
  ...["BODY", "FOOT", "HAND", "HEAD", "NECK", "OBJECT"].map((id) => ({
    kind: "relic-slot" as const,
    id,
    cachePath: null,
  })),
];

function parseRuntimeLookup(value: unknown): RuntimeLookupDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Generated HSR asset lookup must be an object");
  }
  const document = value as Partial<RuntimeLookupDocument>;
  if (document.lookup_schema_version !== "1") {
    throw new Error("Generated HSR asset lookup has an unsupported schema");
  }
  if (
    typeof document.asset_manifest_sha256 !== "string" ||
    typeof document.reference_manifest_sha256 !== "string" ||
    typeof document.source_revision !== "string" ||
    !Array.isArray(document.entries)
  ) {
    throw new Error("Generated HSR asset lookup metadata is incomplete");
  }
  return document as RuntimeLookupDocument;
}

function toLookupEntries(
  document: RuntimeLookupDocument
): CatalogAssetLookupEntry[] {
  return document.entries.map((entry, index) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 3 ||
      !CATALOG_ASSET_KINDS.has(entry[0]) ||
      typeof entry[1] !== "string" ||
      entry[1].length === 0 ||
      (entry[2] !== null && typeof entry[2] !== "string")
    ) {
      throw new Error(`Generated HSR asset lookup entry ${index} is invalid`);
    }
    return { kind: entry[0], id: entry[1], cachePath: entry[2] };
  });
}

export function loadCatalogAssetLookup(): Promise<void> {
  lookupPromise ??= fetch(runtimeLookupUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`asset lookup returned HTTP ${response.status}`);
      }
      const document = parseRuntimeLookup(await response.json());
      configureCatalogAssetLookup(toLookupEntries(document));
    })
    .catch(() => {
      // A fresh development checkout can still render honest placeholders.
      // The required assets:check command fails until the ignored cache is
      // synchronized, so a production handoff cannot silently omit the cache.
      configureCatalogAssetLookup(REQUIRED_FALLBACKS);
    });
  return lookupPromise;
}
