import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDs1 } from "../../worker/importProxy";
import worker from "../../worker/index";
import enkaFixture from "../fixtures/enka-hsr-showcase.json";
import hoyolabFixture from "../fixtures/hoyolab-hsr-avatar-info.json";
import mihomoFixture from "../fixtures/mihomo-hsr-raw.json";

const env = {
  APP_ID: "ggstarrail-test",
  ALLOWED_ORIGIN: "http://localhost:5173,http://127.0.0.1:41737",
  HOYOLAB_CN_PAGE_HASH: "#/hsr?fixture=1",
};
const credentialMarker = "PRIVATE_LTOKEN_MARKER_2026";
const deviceMarker = "PRIVATE_DEVICE_MARKER_2026";

function proxyRequest(pathName: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Origin", "http://localhost:5173");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Request(`https://example.test${pathName}`, { ...init, headers });
}

function authBody(
  uid = "600000001",
  credentials: unknown = {
    kind: "fields",
    fields: {
      cookie_token_v2: credentialMarker,
      account_mid_v2: "sanitized-account-mid",
      account_id_v2: "600000001",
      ltoken_v2: credentialMarker,
      ltmid_v2: "sanitized-lt-mid",
      ltuid_v2: "600000001",
    },
  }
): string {
  return JSON.stringify({
    uid,
    credentials,
    device: {
      deviceId: deviceMarker,
      deviceFp: "1234567890123",
    },
  });
}

function jsonUpstream(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GGStarRail Worker", () => {
  it("serves a resource-free health response", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api/health"),
      env
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      app: "ggstarrail-test",
      product: "GGStarRail",
      status: "ok",
      resourcesConfigured: false,
    });
  });

  it("proxies Enka HSR UID data and honors its TTL for CDN caching only", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonUpstream(enkaFixture));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/enka/uid/600000001"),
      env
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, s-maxage=60"
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://enka.network/api/hsr/uid/600000001/"
    );
    expect(body.source).toMatchObject({
      kind: "enka",
      coverage: "showcase-only",
    });
  });

  it("rejects force-refresh or arbitrary UID proxy query parameters", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      proxyRequest("/api/enka/uid/600000001?is_force_update=true"),
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_REQUEST",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the raw MiHoMo endpoint as a separately labeled failover", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(jsonUpstream({ error: "upstream" }, 503))
      .mockResolvedValueOnce(jsonUpstream(mihomoFixture));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/enka/uid/600000001"),
      env
    );
    const body = (await response.json()) as {
      source: { kind: string; endpointVersion: string };
    };

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.mihomo.me/sr_info/600000001"
    );
    expect(body.source).toMatchObject({
      kind: "mihomo",
      endpointVersion: "mihomo-hsr-raw-v1",
    });
    expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
  });

  it("keeps a 200 empty/private showcase distinct from not found", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonUpstream({
        uid: 600000001,
        region: "prod_official_usa",
        ttl: 30,
        detailInfo: {
          uid: 600000001,
          isDisplayAvatar: false,
          avatarDetailList: [],
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/enka/uid/600000001"),
      env
    );
    const body = (await response.json()) as {
      data: { detailInfo: { avatarDetailList: unknown[] } };
    };

    expect(response.status).toBe(200);
    expect(body.data.detailInfo.avatarDetailList).toEqual([]);
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, s-maxage=30"
    );
  });

  it("returns not found only when both showcase providers return 404", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(jsonUpstream({ detail: "not found" }, 404))
      .mockResolvedValueOnce(jsonUpstream({ detail: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/enka/uid/600000001"),
      env
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "UID_IMPORT_NOT_FOUND",
    });
  });

  it("builds the global Battle Chronicle request with transient v2 fields", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonUpstream(hoyolabFixture));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/hoyolab/os/avatar/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: authBody(),
      }),
      env
    );
    const body = (await response.json()) as Record<string, unknown>;
    const upstreamHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://sg-act-public-api.hoyolab.com/event/game_record/hkrpg/api/avatar/info?role_id=600000001&server=prod_official_usa&need_wiki=true"
    );
    expect(upstreamHeaders.get("x-rpc-app_version")).toBe("1.5.0");
    expect(upstreamHeaders.get("x-rpc-client_type")).toBe("5");
    expect(upstreamHeaders.get("x-rpc-platform")).toBe("4");
    expect(upstreamHeaders.get("x-rpc-device_id")).toBe(deviceMarker);
    expect(upstreamHeaders.get("x-rpc-device_fp")).toBe("1234567890123");
    expect(upstreamHeaders.get("cookie")).toContain(
      `cookie_token_v2=${credentialMarker}`
    );
    expect(upstreamHeaders.get("cookie")).toContain(
      `ltoken_v2=${credentialMarker}`
    );
    expect(upstreamHeaders.get("DS")).toMatch(/^\d+,[A-Za-z]{6},[a-f0-9]{32}$/);
    expect(body.source).toMatchObject({
      kind: "hoyolab-hkrpg-avatar-info",
      transport: "global-primary",
    });
    expect(JSON.stringify(body)).not.toContain(credentialMarker);
    expect(JSON.stringify(body)).not.toContain(deviceMarker);
  });

  it("accepts a raw Cookie transiently and forwards only modern allowlisted fields", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonUpstream(hoyolabFixture));
    vi.stubGlobal("fetch", fetchMock);
    const unrelatedMarker = "DO_NOT_FORWARD_THIS_COOKIE";

    const response = await worker.fetch(
      proxyRequest("/api/hoyolab/os/avatar/info", {
        method: "POST",
        body: authBody("600000001", {
          kind: "raw-cookie",
          rawCookie: `unrelated=${unrelatedMarker}; account_id_v2=600000001; cookie_token_v2=${credentialMarker}`,
        }),
      }),
      env
    );
    const upstreamHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(upstreamHeaders.get("cookie")).toBe(
      `cookie_token_v2=${credentialMarker}; account_id_v2=600000001`
    );
    expect(upstreamHeaders.get("cookie")).not.toContain(unrelatedMarker);
    expect(text).not.toContain(credentialMarker);
    expect(text).not.toContain(unrelatedMarker);
  });

  it("uses the CN browser DS1 base and configured page formula", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonUpstream(hoyolabFixture));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/hoyolab/cn/avatar/info", {
        method: "POST",
        body: authBody("100000001"),
      }),
      env
    );
    const upstreamHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api-takumi-record.mihoyo.com/game_record/hkrpg/api/avatar/info?role_id=100000001&server=prod_gf_cn&need_wiki=true"
    );
    expect(upstreamHeaders.get("x-rpc-app_version")).toBe("2.3.0");
    expect(upstreamHeaders.get("x-rpc-page")).toBe("v4.5.0_#/hsr");
    expect(upstreamHeaders.get("x-rpc-tool_verison")).toBe("v4.5.0");
    expect(upstreamHeaders.get("DS")).toMatch(/^\d+,[A-Za-z]{6},[a-f0-9]{32}$/);
  });

  it("fails closed when CN page fingerprint or transient device material is absent", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const missingPage = await worker.fetch(
      proxyRequest("/api/hoyolab/cn/avatar/info", {
        method: "POST",
        body: authBody("100000001"),
      }),
      { ...env, HOYOLAB_CN_PAGE_HASH: undefined }
    );
    const missingDevice = await worker.fetch(
      proxyRequest("/api/hoyolab/os/avatar/info", {
        method: "POST",
        body: JSON.stringify({
          uid: "600000001",
          credentials: {
            kind: "fields",
            fields: { cookie_token_v2: credentialMarker },
          },
        }),
      }),
      env
    );

    expect(missingPage.status).toBe(503);
    await expect(missingPage.json()).resolves.toEqual({
      error: "HOYOLAB_CONFIGURATION_REQUIRED",
    });
    expect(missingDevice.status).toBe(400);
    await expect(missingDevice.json()).resolves.toEqual({
      error: "HOYOLAB_CONFIGURATION_REQUIRED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    10034, 10035,
  ])("surfaces global interactive Geetest retcode %i without solving it", async (retcode) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonUpstream({ retcode, message: credentialMarker, data: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/hoyolab/os/avatar/info", {
        method: "POST",
        body: authBody(),
      }),
      env
    );
    const text = await response.text();

    expect(response.status).toBe(409);
    expect(JSON.parse(text)).toEqual({
      error: "HOYOLAB_SECURITY_VERIFICATION_REQUIRED",
      retcode,
      challenge: { kind: "geetest", interactive: true },
    });
    expect(text).not.toContain(credentialMarker);
  });

  it("treats CN retcode 10034 as rejection and 10035 as interactive", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(jsonUpstream({ retcode: 10034, data: null }))
      .mockResolvedValueOnce(jsonUpstream({ retcode: 10035, data: null }));
    vi.stubGlobal("fetch", fetchMock);

    const rejected = await worker.fetch(
      proxyRequest("/api/hoyolab/cn/avatar/info", {
        method: "POST",
        body: authBody("100000001"),
      }),
      env
    );
    const interactive = await worker.fetch(
      proxyRequest("/api/hoyolab/cn/avatar/info", {
        method: "POST",
        body: authBody("100000001"),
      }),
      env
    );

    expect(rejected.status).toBe(502);
    await expect(rejected.json()).resolves.toEqual({
      error: "HOYOLAB_UPSTREAM_REJECTED",
      retcode: 10034,
    });
    expect(interactive.status).toBe(409);
    await expect(interactive.json()).resolves.toMatchObject({
      error: "HOYOLAB_SECURITY_VERIFICATION_REQUIRED",
      retcode: 10035,
    });
  });

  it("surfaces hard risk-block retcode 10041 without upstream message", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonUpstream({ retcode: 10041, message: credentialMarker, data: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      proxyRequest("/api/hoyolab/os/avatar/info", {
        method: "POST",
        body: authBody(),
      }),
      env
    );
    const text = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(text)).toEqual({
      error: "HOYOLAB_RISK_BLOCKED",
      retcode: 10041,
    });
    expect(text).not.toContain(credentialMarker);
  });

  it("rejects disallowed origins before reading or forwarding credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      new Request("https://example.test/api/hoyolab/os/avatar/info", {
        method: "POST",
        headers: { Origin: "https://attacker.test" },
        body: authBody(),
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(credentialMarker);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the exact detached-demo origin and returns that actual origin", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonUpstream(enkaFixture));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      new Request("https://example.test/api/enka/uid/600000001", {
        headers: { Origin: "http://127.0.0.1:41737" },
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://127.0.0.1:41737"
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).not.toContain(
      ","
    );
  });

  it("creates a deterministic DS1 digest for audited compatibility values", () => {
    const salt = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
    const expected = createHash("md5")
      .update(`salt=${salt}&t=1234567890&r=AbCdEf`)
      .digest("hex");
    expect(createDs1(salt, 1_234_567_890, "AbCdEf")).toBe(
      `1234567890,AbCdEf,${expected}`
    );
  });

  it("contains no credential logging or storage in the Worker boundary", () => {
    const source = ["worker/index.ts", "worker/importProxy.ts"]
      .map((file) => fs.readFileSync(path.resolve(file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/console\.(log|info|warn|error)/);
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
});
