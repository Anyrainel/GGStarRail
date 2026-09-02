import { md5Hex } from "./md5";

export interface ImportProxyEnv {
  ALLOWED_ORIGIN: string;
  /**
   * Exact deployed Battle Chronicle hash approved for the current CN bundle.
   * The first-party bundle derives x-rpc-page as
   * `v4.5.0_${window.location.hash.replace(/(\?.*|\/\?.*|\/$)/, "")}`.
   */
  HOYOLAB_CN_PAGE_HASH?: string;
}

type HoYoLabRegion = "os" | "cn";

const HOYOLAB_COOKIE_NAMES = [
  "cookie_token_v2",
  "account_mid_v2",
  "account_id_v2",
  "ltoken_v2",
  "ltmid_v2",
  "ltuid_v2",
] as const;

type HoYoLabCookieName = (typeof HOYOLAB_COOKIE_NAMES)[number];

type HoYoLabCredentialInput =
  | { kind: "raw-cookie"; rawCookie: string }
  | {
      kind: "fields";
      fields: Partial<Record<HoYoLabCookieName, string>>;
    };

interface HoYoLabDeviceIdentity {
  deviceId: string;
  deviceFp: string;
}

interface HoYoLabRequestBody {
  uid: string;
  cookie: string;
  device: HoYoLabDeviceIdentity;
}

const ENKA_URL = "https://enka.network/api/hsr/uid";
const MIHOMO_URL = "https://api.mihomo.me/sr_info";
const HOYOLAB_BASES = {
  os: "https://sg-act-public-api.hoyolab.com/event/game_record/hkrpg/api",
  cn: "https://api-takumi-record.mihoyo.com/game_record/hkrpg/api",
} as const;

// These are public compatibility constants recovered from current first-party
// request bundles, not application secrets. Authenticated live success has not
// been claimed without an authorized credential test.
const HOYOLAB_FINGERPRINTS = {
  os: {
    appVersion: "1.5.0",
    clientType: "5",
    platform: "4",
    salt: "6s25p5ox5y14umn1p61aqyyvbvvl3lrt",
  },
  cn: {
    appVersion: "2.3.0",
    clientType: "5",
    platform: "4",
    salt: "h8w582wxwgqvahcdkpvdhbh2w9casgfl",
    toolVersion: "v4.5.0",
  },
} as const;

const SERVER_BY_UID_PREFIX = {
  "1": "prod_gf_cn",
  "2": "prod_gf_cn",
  "5": "prod_qd_cn",
  "6": "prod_official_usa",
  "7": "prod_official_eur",
  "8": "prod_official_asia",
  "9": "prod_official_cht",
} as const;

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    [...expected].sort().every((key, index) => key === keys[index])
  );
}

function isUid(value: unknown): value is string {
  return typeof value === "string" && /^\d{9}$/.test(value);
}

function serverForUid(uid: string): string | null {
  return (
    SERVER_BY_UID_PREFIX[uid[0] as keyof typeof SERVER_BY_UID_PREFIX] ?? null
  );
}

function regionMatchesUid(region: HoYoLabRegion, uid: string): boolean {
  const server = serverForUid(uid);
  if (!server) return false;
  const isCn = server === "prod_gf_cn" || server === "prod_qd_cn";
  return (region === "cn") === isCn;
}

function hasUnsafeMaterialCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      code <= 0x20 || code === 0x7f || character === ";" || character === ","
    );
  });
}

function isSafeMaterial(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !hasUnsafeMaterialCharacter(value)
  );
}

function isCookieName(value: string): value is HoYoLabCookieName {
  return (HOYOLAB_COOKIE_NAMES as readonly string[]).includes(value);
}

function cookieFromFields(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const names = Object.keys(value);
  if (
    names.length === 0 ||
    names.some((name) => !isCookieName(name)) ||
    names.some((name) => !isSafeMaterial(value[name], 4096))
  ) {
    return null;
  }
  return HOYOLAB_COOKIE_NAMES.flatMap((name) => {
    const field = value[name];
    return typeof field === "string" ? [`${name}=${field}`] : [];
  }).join("; ");
}

function cookieFromRaw(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 12 * 1024 ||
    value.includes("\r") ||
    value.includes("\n") ||
    value.includes(String.fromCharCode(0))
  ) {
    return null;
  }
  const selected = new Map<HoYoLabCookieName, string>();
  for (const part of value.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    if (!isCookieName(name)) continue;
    const field = part.slice(separator + 1).trim();
    if (!isSafeMaterial(field, 4096) || selected.has(name)) return null;
    selected.set(name, field);
  }
  if (selected.size === 0) return null;
  return HOYOLAB_COOKIE_NAMES.flatMap((name) => {
    const field = selected.get(name);
    return field ? [`${name}=${field}`] : [];
  }).join("; ");
}

function parseCredentials(value: unknown): string | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (
    value.kind === "raw-cookie" &&
    hasExactKeys(value, ["kind", "rawCookie"])
  ) {
    return cookieFromRaw(value.rawCookie);
  }
  if (value.kind === "fields" && hasExactKeys(value, ["kind", "fields"])) {
    return cookieFromFields(value.fields);
  }
  return null;
}

function parseHoYoLabBody(
  value: unknown,
  region: HoYoLabRegion
): HoYoLabRequestBody | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["uid", "credentials", "device"]) ||
    !isUid(value.uid) ||
    !regionMatchesUid(region, value.uid) ||
    !isRecord(value.device) ||
    !hasExactKeys(value.device, ["deviceId", "deviceFp"])
  ) {
    return null;
  }
  const cookie = parseCredentials(value.credentials);
  const device = value.device;
  if (
    !cookie ||
    !isSafeMaterial(device.deviceId, 128) ||
    !isSafeMaterial(device.deviceFp, 128)
  ) {
    return null;
  }
  return {
    uid: value.uid,
    cookie,
    device: {
      deviceId: device.deviceId,
      deviceFp: device.deviceFp,
    },
  };
}

function isMissingHoYoLabConfiguration(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const credentials = value.credentials;
  const device = value.device;
  if (!isRecord(credentials) || !isRecord(device)) return true;
  const credentialInput = credentials as HoYoLabCredentialInput;
  const credentialMissing =
    (credentialInput.kind === "raw-cookie" && !credentialInput.rawCookie) ||
    (credentialInput.kind === "fields" &&
      (!isRecord(credentialInput.fields) ||
        Object.keys(credentialInput.fields).length === 0)) ||
    (credentialInput.kind !== "raw-cookie" &&
      credentialInput.kind !== "fields");
  return (
    credentialMissing ||
    typeof device.deviceId !== "string" ||
    device.deviceId.length === 0 ||
    typeof device.deviceFp !== "string" ||
    device.deviceFp.length === 0
  );
}

export function approvedRequestOrigin(
  request: Request,
  env: ImportProxyEnv
): string | null | false {
  const origin = request.headers.get("Origin");
  if (origin === null) return null;
  const configured = env.ALLOWED_ORIGIN.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : false;
}

function responseHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Pragma: "no-cache",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
  serverTtl?: number
): Response {
  const headers = responseHeaders(origin);
  if (serverTtl !== undefined && serverTtl > 0) {
    headers.set("CDN-Cache-Control", `public, s-maxage=${serverTtl}`);
    headers.set(
      "Cloudflare-CDN-Cache-Control",
      `public, s-maxage=${serverTtl}`
    );
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function preflight(
  request: Request,
  env: ImportProxyEnv,
  methods: string
): Response {
  const origin = approvedRequestOrigin(request, env);
  if (origin === false) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, null);
  const headers = responseHeaders(origin);
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", methods);
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}

function secureRandomString(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomIndex = (): number => {
    const range = 0x1_0000_0000;
    const limit = range - (range % alphabet.length);
    const value = new Uint32Array(1);
    do {
      crypto.getRandomValues(value);
    } while (value[0] >= limit);
    return value[0] % alphabet.length;
  };
  return Array.from({ length }, () => alphabet[randomIndex()]).join("");
}

export function createDs1(
  salt: string,
  timestamp = Math.floor(Date.now() / 1000),
  random = secureRandomString(6)
): string {
  const digest = md5Hex(`salt=${salt}&t=${timestamp}&r=${random}`);
  return `${timestamp},${random},${digest}`;
}

async function readJsonWithLimit(
  response: Response,
  maximumBytes: number
): Promise<unknown> {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error("UPSTREAM_RESPONSE_TOO_LARGE");
  }
  const reader = response.body?.getReader();
  if (!reader) return JSON.parse(await response.text());
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("UPSTREAM_RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function upstreamJson(
  url: string,
  init: RequestInit
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  return {
    status: response.status,
    body: await readJsonWithLimit(response, MAX_RESPONSE_BYTES),
  };
}

function enkaTtl(value: unknown): number {
  if (!isRecord(value) || !Number.isInteger(value.ttl)) return 0;
  return Math.max(0, Math.min(value.ttl as number, 86_400));
}

async function fetchEnka(uid: string): Promise<{
  status: number;
  body?: unknown;
}> {
  try {
    const result = await upstreamJson(`${ENKA_URL}/${uid}/`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "GGStarRail/0.1 account-import",
      },
    });
    return { status: result.status, body: result.body };
  } catch {
    return { status: 502 };
  }
}

async function fetchMiHoMo(uid: string): Promise<{
  status: number;
  body?: unknown;
}> {
  try {
    const result = await upstreamJson(`${MIHOMO_URL}/${uid}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "GGStarRail/0.1 account-import",
      },
    });
    return { status: result.status, body: result.body };
  } catch {
    return { status: 502 };
  }
}

async function handleUidShowcase(
  request: Request,
  url: URL,
  env: ImportProxyEnv,
  uid: string
): Promise<Response> {
  const origin = approvedRequestOrigin(request, env);
  if (origin === false) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, null);
  if (request.method === "OPTIONS")
    return preflight(request, env, "GET, OPTIONS");
  if (request.method !== "GET") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405, origin);
  }
  if (url.search !== "") {
    return json({ error: "INVALID_REQUEST" }, 400, origin);
  }

  const enka = await fetchEnka(uid);
  if (enka.status >= 200 && enka.status < 300 && isRecord(enka.body)) {
    const ttl = enkaTtl(enka.body);
    return json(
      {
        source: {
          kind: "enka",
          endpointVersion: "enka-hsr-uid-v1",
          coverage: "showcase-only",
        },
        data: enka.body,
      },
      200,
      origin,
      ttl
    );
  }

  const mihomo = await fetchMiHoMo(uid);
  if (mihomo.status >= 200 && mihomo.status < 300 && isRecord(mihomo.body)) {
    return json(
      {
        source: {
          kind: "mihomo",
          endpointVersion: "mihomo-hsr-raw-v1",
          coverage: "showcase-only",
        },
        data: mihomo.body,
      },
      200,
      origin
    );
  }

  if (enka.status === 404 && mihomo.status === 404) {
    return json({ error: "UID_IMPORT_NOT_FOUND" }, 404, origin);
  }
  if (enka.status === 429 || mihomo.status === 429) {
    return json({ error: "UID_IMPORT_RATE_LIMITED" }, 503, origin);
  }
  return json({ error: "UID_IMPORT_UPSTREAM_UNAVAILABLE" }, 502, origin);
}

function normalizedCnPage(hash: string | undefined): string | null {
  if (!hash || hash.length > 512 || !/^#[A-Za-z0-9/_?=&.%~-]+$/.test(hash)) {
    return null;
  }
  return hash.replace(/(\?.*|\/\?.*|\/$)/, "");
}

function hoYoLabHeaders(
  region: HoYoLabRegion,
  body: HoYoLabRequestBody,
  cnPage: string | null
): Headers {
  const fingerprint = HOYOLAB_FINGERPRINTS[region];
  const headers = new Headers({
    Accept: "application/json, text/plain, */*",
    Cookie: body.cookie,
    DS: createDs1(fingerprint.salt),
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
    "x-rpc-app_version": fingerprint.appVersion,
    "x-rpc-client_type": fingerprint.clientType,
    "x-rpc-device_fp": body.device.deviceFp,
    "x-rpc-device_id": body.device.deviceId,
    "x-rpc-platform": fingerprint.platform,
  });
  if (region === "os") {
    headers.set("Origin", "https://act.hoyolab.com");
    headers.set("Referer", "https://act.hoyolab.com/");
    headers.set("x-rpc-language", "en-us");
  } else {
    const toolVersion = HOYOLAB_FINGERPRINTS.cn.toolVersion;
    headers.set("Origin", "https://webstatic.mihoyo.com");
    headers.set("Referer", "https://webstatic.mihoyo.com/");
    headers.set("x-rpc-language", "zh-cn");
    headers.set("x-rpc-page", `${toolVersion}_${cnPage ?? ""}`);
    headers.set("x-rpc-tool_verison", toolVersion);
  }
  return headers;
}

async function fetchHoYoLab(
  region: HoYoLabRegion,
  body: HoYoLabRequestBody,
  cnPage: string | null
): Promise<
  | { ok: true; body: Record<string, unknown>; transport: string }
  | { ok: false; status: number }
> {
  const server = serverForUid(body.uid);
  if (!server) return { ok: false, status: 400 };
  const query = new URLSearchParams({
    role_id: body.uid,
    server,
    need_wiki: "true",
  });
  try {
    const result = await upstreamJson(
      `${HOYOLAB_BASES[region]}/avatar/info?${query}`,
      {
        method: "GET",
        headers: hoYoLabHeaders(region, body, cnPage),
      }
    );
    if (result.status >= 200 && result.status < 300 && isRecord(result.body)) {
      return {
        ok: true,
        body: result.body,
        transport: region === "cn" ? "cn-primary" : "global-primary",
      };
    }
    return { ok: false, status: result.status };
  } catch {
    return { ok: false, status: 502 };
  }
}

function retcodeOf(value: Record<string, unknown>): number | null {
  return Number.isInteger(value.retcode) ? (value.retcode as number) : null;
}

async function handleHoYoLab(
  request: Request,
  env: ImportProxyEnv,
  region: HoYoLabRegion
): Promise<Response> {
  const origin = approvedRequestOrigin(request, env);
  if (origin === false) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, null);
  if (request.method === "OPTIONS") {
    return preflight(request, env, "POST, OPTIONS");
  }
  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405, origin);
  }
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return json({ error: "INVALID_REQUEST" }, 400, origin);
  }
  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "REQUEST_TOO_LARGE" }, 413, origin);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    return json({ error: "REQUEST_TOO_LARGE" }, 413, origin);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "INVALID_REQUEST" }, 400, origin);
  }
  if (isMissingHoYoLabConfiguration(parsed)) {
    return json({ error: "HOYOLAB_CONFIGURATION_REQUIRED" }, 400, origin);
  }
  const body = parseHoYoLabBody(parsed, region);
  if (!body) return json({ error: "INVALID_REQUEST" }, 400, origin);

  const cnPage =
    region === "cn" ? normalizedCnPage(env.HOYOLAB_CN_PAGE_HASH) : null;
  if (region === "cn" && !cnPage) {
    return json({ error: "HOYOLAB_CONFIGURATION_REQUIRED" }, 503, origin);
  }
  const upstream = await fetchHoYoLab(region, body, cnPage);
  if (!upstream.ok) {
    const status = upstream.status === 429 ? 503 : 502;
    return json(
      {
        error:
          upstream.status === 429
            ? "HOYOLAB_RATE_LIMITED"
            : "HOYOLAB_UPSTREAM_HTTP",
      },
      status,
      origin
    );
  }
  const retcode = retcodeOf(upstream.body);
  if (retcode === null) {
    return json({ error: "HOYOLAB_UPSTREAM_INVALID_RESPONSE" }, 502, origin);
  }
  if (
    (region === "os" && (retcode === 10034 || retcode === 10035)) ||
    (region === "cn" && retcode === 10035)
  ) {
    return json(
      {
        error: "HOYOLAB_SECURITY_VERIFICATION_REQUIRED",
        retcode,
        challenge: { kind: "geetest", interactive: true },
      },
      409,
      origin
    );
  }
  if (retcode === 10041) {
    return json({ error: "HOYOLAB_RISK_BLOCKED", retcode }, 403, origin);
  }
  if (retcode === -100 || retcode === -10001 || retcode === 10001) {
    return json({ error: "HOYOLAB_AUTH_REQUIRED", retcode }, 401, origin);
  }
  if (retcode !== 0) {
    return json({ error: "HOYOLAB_UPSTREAM_REJECTED", retcode }, 502, origin);
  }
  return json(
    {
      source: {
        kind: "hoyolab-hkrpg-avatar-info",
        region,
        transport: upstream.transport,
      },
      data: upstream.body,
    },
    200,
    origin
  );
}

export async function handleImportProxy(
  request: Request,
  url: URL,
  env: ImportProxyEnv
): Promise<Response | null> {
  const uidMatch = /^\/api\/enka\/uid\/(\d{9})$/.exec(url.pathname);
  if (uidMatch) {
    return handleUidShowcase(request, url, env, uidMatch[1]);
  }
  if (url.pathname.startsWith("/api/enka/")) {
    const origin = approvedRequestOrigin(request, env);
    if (origin === false)
      return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, null);
    return json({ error: "NOT_FOUND" }, 404, origin);
  }
  const hoYoLabMatch = /^\/api\/hoyolab\/(os|cn)\/avatar\/info$/.exec(
    url.pathname
  );
  if (hoYoLabMatch) {
    if (url.search !== "") {
      const origin = approvedRequestOrigin(request, env);
      if (origin === false)
        return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, null);
      return json({ error: "INVALID_REQUEST" }, 400, origin);
    }
    return handleHoYoLab(request, env, hoYoLabMatch[1] as HoYoLabRegion);
  }
  if (url.pathname.startsWith("/api/hoyolab/")) {
    const origin = approvedRequestOrigin(request, env);
    if (origin === false)
      return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, null);
    return json({ error: "NOT_FOUND" }, 404, origin);
  }
  return null;
}
