import { ASSET_NAMESPACE } from "@/config/identity";
import type {
  CatalogAssetKind,
  CatalogAssetLookupEntry,
  CatalogAssetRef,
} from "@/domain/assets";

export interface ResolvedCatalogAsset {
  src: string;
  fallbackSrc: string;
  entry: CatalogAssetLookupEntry | null;
  startsWithFallback: boolean;
}

const FALLBACK_LABELS: Record<CatalogAssetKind, string> = {
  achievement: "AC",
  "achievement-category": "AS",
  "achievement-reward": "SJ",
  character: "CH",
  "light-cone": "LC",
  "relic-set": "RS",
  "relic-piece": "RP",
  "relic-slot": "SL",
  path: "PA",
  "combat-type": "CT",
  property: "ST",
};

const RELIC_SLOT_FALLBACK_LABELS: Readonly<Record<string, string>> = {
  BODY: "BD",
  FOOT: "FT",
  HAND: "HN",
  HEAD: "HD",
  NECK: "SP",
  OBJECT: "RP",
};

let entriesByKey = new Map<string, CatalogAssetLookupEntry>();
let entriesBySourcePath = new Map<string, CatalogAssetLookupEntry>();

function normalizeAssetPath(assetPath: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(assetPath) || assetPath.startsWith("//")) {
    throw new Error("Asset paths must be local paths");
  }
  const normalized = assetPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalized.split("/").includes("..")) {
    throw new Error("Asset paths cannot traverse parent directories");
  }
  return normalized;
}

function lookupKey(kind: CatalogAssetKind, value: string): string {
  return `${kind}\0${value}`;
}

function validateLookupEntry(
  entry: CatalogAssetLookupEntry
): CatalogAssetLookupEntry {
  if (!entry.id) {
    throw new Error("Catalog asset IDs must be non-empty");
  }
  if (entry.sourcePath === "") {
    throw new Error("Catalog asset source paths must be non-empty when set");
  }
  return {
    ...entry,
    sourcePath: entry.sourcePath || null,
    cachePath: entry.cachePath ? normalizeAssetPath(entry.cachePath) : null,
  };
}

export function configureCatalogAssetLookup(
  entries: readonly CatalogAssetLookupEntry[]
): void {
  const nextByKey = new Map<string, CatalogAssetLookupEntry>();
  const nextBySourcePath = new Map<string, CatalogAssetLookupEntry>();
  for (const input of entries) {
    const entry = validateLookupEntry(input);
    const idKey = lookupKey(entry.kind, entry.id);
    if (nextByKey.has(idKey)) {
      throw new Error(`Duplicate catalog asset ID: ${entry.kind}:${entry.id}`);
    }
    if (entry.sourcePath) {
      const sourceKey = lookupKey(entry.kind, entry.sourcePath);
      const existingSource = nextBySourcePath.get(sourceKey);
      if (existingSource && existingSource.cachePath !== entry.cachePath) {
        throw new Error(
          `Catalog asset source path resolves inconsistently: ${entry.sourcePath}`
        );
      }
      nextBySourcePath.set(sourceKey, entry);
    }
    nextByKey.set(idKey, entry);
  }
  entriesByKey = nextByKey;
  entriesBySourcePath = nextBySourcePath;
}

export function getAssetUrl(assetPath: string): string {
  const normalized = normalizeAssetPath(assetPath);
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${baseUrl}${normalized}`;
}

export function getAssetFallbackDataUrl(ref: CatalogAssetRef): string {
  const label =
    ref.kind === "relic-slot"
      ? (RELIC_SLOT_FALLBACK_LABELS[ref.id] ?? FALLBACK_LABELS[ref.kind])
      : ref.kind === "property" && ref.id === "StanceBreakAddedRatio"
        ? "BE"
        : FALLBACK_LABELS[ref.kind];
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">',
    '<rect width="128" height="128" rx="18" fill="#171a26"/>',
    '<path d="M21 94 49 58l17 20 13-15 28 31Z" fill="#343a52"/>',
    '<circle cx="91" cy="39" r="12" fill="#4b526d"/>',
    `<text x="64" y="114" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#c6cad8">${label}</text>`,
    "</svg>",
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function resolveCatalogAsset(
  ref: CatalogAssetRef
): ResolvedCatalogAsset {
  const idEntry = entriesByKey.get(lookupKey(ref.kind, ref.id));
  const sourcePath =
    ref.kind === "property" && ref.sourcePath === "0" ? null : ref.sourcePath;
  const sourceEntry = sourcePath
    ? entriesBySourcePath.get(lookupKey(ref.kind, sourcePath))
    : undefined;
  const entry = idEntry ?? sourceEntry ?? null;
  const fallbackSrc = getAssetFallbackDataUrl(ref);
  if (!entry?.cachePath) {
    return { src: fallbackSrc, fallbackSrc, entry, startsWithFallback: true };
  }
  return {
    src: getAssetUrl(`${ASSET_NAMESPACE}/${entry.cachePath}`),
    fallbackSrc,
    entry,
    startsWithFallback: false,
  };
}

export function getCatalogAssetUrl(ref: CatalogAssetRef): string {
  return resolveCatalogAsset(ref).src;
}
