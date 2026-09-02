import { starRailServerForUid } from "@/providers/accountNormalization";
import {
  type AccountImportCatalog,
  loadAccountImportCatalog,
} from "@/providers/importCatalog";
import { normalizeMiHoMoRawShowcase } from "@/providers/mihomo/schema";
import type { AccountImportDraft } from "@/providers/types";
import { normalizeEnkaHsrShowcase } from "./schema";

export type EnkaShowcaseTransport = (uid: string) => Promise<unknown>;

const SAFE_PROXY_ERRORS = new Set([
  "UID_IMPORT_NOT_FOUND",
  "UID_IMPORT_RATE_LIMITED",
  "UID_IMPORT_UPSTREAM_UNAVAILABLE",
  "INVALID_REQUEST",
  "ORIGIN_NOT_ALLOWED",
]);

async function defaultEnkaShowcaseTransport(uid: string): Promise<unknown> {
  const response = await fetch(`/api/enka/uid/${encodeURIComponent(uid)}`, {
    method: "GET",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (typeof body?.error === "string" && SAFE_PROXY_ERRORS.has(body.error)) {
      throw new Error(body.error);
    }
    throw new Error(`UID_IMPORT_HTTP_${response.status}`);
  }
  return response.json();
}

function proxyPayload(
  input: unknown
): { kind: "enka" | "mihomo"; data: unknown } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (!record.source || typeof record.source !== "object") return null;
  const source = record.source as Record<string, unknown>;
  return source.kind === "enka" || source.kind === "mihomo"
    ? { kind: source.kind, data: record.data }
    : null;
}

export async function importFromUidShowcase(
  uid: string,
  options: {
    transport?: EnkaShowcaseTransport;
    catalog?: AccountImportCatalog;
    now?: Date;
  } = {}
): Promise<AccountImportDraft> {
  if (starRailServerForUid(uid) === null) {
    throw new Error("UID_IMPORT_INVALID_UID");
  }

  try {
    const transport = options.transport ?? defaultEnkaShowcaseTransport;
    const [input, catalog] = await Promise.all([
      transport(uid),
      options.catalog ?? loadAccountImportCatalog(),
    ]);
    const envelope = proxyPayload(input);
    return envelope?.kind === "mihomo"
      ? normalizeMiHoMoRawShowcase(
          envelope.data,
          catalog,
          options.now ?? new Date(),
          uid
        )
      : normalizeEnkaHsrShowcase(
          envelope?.data ?? input,
          catalog,
          options.now ?? new Date(),
          uid
        );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "UID_IMPORT_INVALID_UID" ||
        error.message === "UID_IMPORT_INVALID_RESPONSE" ||
        error.message === "UID_IMPORT_IDENTITY_MISMATCH" ||
        error.message === "UID_IMPORT_NOT_FOUND" ||
        error.message === "UID_IMPORT_RATE_LIMITED" ||
        error.message === "UID_IMPORT_UPSTREAM_UNAVAILABLE" ||
        error.message === "INVALID_REQUEST" ||
        error.message === "ORIGIN_NOT_ALLOWED" ||
        /^UID_IMPORT_HTTP_\d+$/.test(error.message))
    ) {
      throw error;
    }
    throw new Error("UID_IMPORT_FAILED");
  }
}
