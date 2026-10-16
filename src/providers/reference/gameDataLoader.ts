import { getReferenceLocale } from "@/config/referenceLocale";
import type { ReferenceLocale } from "@/domain/provenance";
import manifest from "../../generated/catalog/manifest.json";
import { betaEnabled } from "./betaState";
import {
  mergeBetaCharacterAdditions,
  mergeReleasedData,
  restoreLocalizedText,
  restoreSourceRevision,
} from "./gameDataUtil";

// URLs keep game data out of JavaScript, with independent content hashes for
// every member, language and release channel. Beta URLs never trigger a fetch
// until the hidden preference is enabled.
const urls = import.meta.glob<string>(
  ["../../generated/catalog/*.json", "../../generated/catalog/*.json.gz"],
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

const pending = new Map<string, Promise<unknown>>();
const files = new Map<string, Promise<unknown>>();
const betaIds = new Map<string, ReadonlySet<string>>();

function entityIds(document: unknown): Set<string> {
  if (
    typeof document !== "object" ||
    document === null ||
    !("value" in document) ||
    !Array.isArray(document.value)
  )
    return new Set();
  return new Set(
    document.value.map((entry: { id: string | number }) => String(entry.id))
  );
}

export function isBetaEntity(member: string, id: string | number): boolean {
  return betaEnabled() && (betaIds.get(member)?.has(String(id)) ?? false);
}

function fetchJson(path: string): Promise<unknown> {
  let promise = files.get(path);
  if (!promise) {
    promise = fetchFile(path).catch((error: unknown) => {
      files.delete(path);
      throw error;
    });
    files.set(path, promise);
  }
  return promise;
}

async function fetchFile(path: string): Promise<unknown> {
  const url = urls[`../../generated/catalog/${path}`];
  if (!url) throw new Error(`Missing game data file: ${path}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Game data request failed: ${path} (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Some hosts already decode Content-Encoding. Inspect the bytes, not just
  // the suffix, so gzip is decompressed exactly once.
  const text =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? await new Response(
          new Response(bytes).body!.pipeThrough(new DecompressionStream("gzip"))
        ).text()
      : new TextDecoder().decode(bytes);
  return JSON.parse(text) as unknown;
}

function textMap(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid game text map: ${path}`);
  }
  return value as Record<string, unknown>;
}

async function loadPartition(
  member: string,
  beta: boolean,
  locale: ReferenceLocale
): Promise<unknown> {
  const prefix = beta ? `${member}_beta` : member;
  const suffix = beta ? ".json.gz" : ".json";
  const [stats, text] = await Promise.all(
    ["stats", locale === "en" ? "en" : "zh"].map((part) =>
      fetchJson(`${prefix}_${part}${suffix}`)
    )
  );
  return restoreSourceRevision(
    restoreLocalizedText(stats, { [locale]: textMap(text, prefix) }),
    manifest.source_revision
  );
}

export function loadGameMember(
  member: string,
  locale = getReferenceLocale()
): Promise<unknown> {
  const includeBeta = betaEnabled();
  const key = `${member}:${includeBeta}:${locale}`;
  let promise = pending.get(key);
  if (!promise) {
    promise = (async () => {
      const released = await loadPartition(member, false, locale);
      if (!includeBeta) return released;
      const beta = await loadPartition(member, true, locale);
      const releasedIds = entityIds(released);
      betaIds.set(
        member,
        new Set([...entityIds(beta)].filter((id) => !releasedIds.has(id)))
      );
      const merged = mergeReleasedData(released, beta);
      return member === "characters"
        ? mergeBetaCharacterAdditions(merged, beta)
        : merged;
    })().catch((error: unknown) => {
      // A transient connection failure must not poison retries for this tab.
      pending.delete(key);
      throw error;
    });
    pending.set(key, promise);
  }
  return promise;
}
