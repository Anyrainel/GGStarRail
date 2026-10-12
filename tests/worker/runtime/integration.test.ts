import { exports } from "cloudflare:workers";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import enkaFixture from "../../fixtures/enka-hsr-showcase.json";
import mihomoFixture from "../../fixtures/mihomo-hsr-raw.json";
import { network } from "./network";

describe("deployed Worker runtime", () => {
  it("loads the configured bindings through the real fetch entry point", async () => {
    const response = await exports.default.fetch(
      "https://hsr.ggartifact.com/api/health"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      app: "ggstarrail",
      status: "ok",
    });
  });

  it("proxies an outbound showcase with MSW in workerd", async () => {
    network.use(
      http.get("https://enka.network/api/hsr/uid/600000001/", () =>
        HttpResponse.json(enkaFixture)
      )
    );
    const response = await exports.default.fetch(
      "https://hsr.ggartifact.com/api/enka/uid/600000001"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, s-maxage=60"
    );
    expect(await response.json()).toMatchObject({
      source: { kind: "enka", coverage: "showcase-only" },
    });
  });

  it("falls back to MiHoMo without relabeling its source", async () => {
    network.use(
      http.get("https://enka.network/api/hsr/uid/600000001/", () =>
        HttpResponse.json({}, { status: 503 })
      ),
      http.get("https://api.mihomo.me/sr_info/600000001", () =>
        HttpResponse.json(mihomoFixture)
      )
    );
    const response = await exports.default.fetch(
      "https://hsr.ggartifact.com/api/enka/uid/600000001"
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: { kind: "mihomo" } });
  });

  it("rejects upstream redirects without forwarding transient credentials", async () => {
    let redirectedRequests = 0;
    network.use(
      http.get(
        "https://sg-act-public-api.hoyolab.com/event/game_record/hkrpg/api/avatar/info",
        ({ request }) => {
          expect(request.headers.get("cookie")).toContain(
            "cookie_token_v2=runtime-test-token"
          );
          return new HttpResponse(null, {
            status: 302,
            headers: { Location: "https://redirect.example/collect" },
          });
        }
      ),
      http.get("https://redirect.example/collect", () => {
        redirectedRequests++;
        return HttpResponse.json({});
      })
    );
    const response = await exports.default.fetch(
      "https://hsr.ggartifact.com/api/hoyolab/os/avatar/info",
      {
        method: "POST",
        headers: {
          Origin: "https://hsr.ggartifact.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: "600000001",
          credentials: {
            kind: "fields",
            fields: {
              cookie_token_v2: "runtime-test-token",
              account_id_v2: "600000001",
            },
          },
          device: {
            deviceId: "runtime-test-device",
            deviceFp: "1234567890123",
          },
        }),
      }
    );
    expect(response.status).toBe(502);
    expect(redirectedRequests).toBe(0);
    expect(await response.text()).not.toContain("runtime-test-token");
  });

  it("serves a direct app navigation through the real assets binding", async () => {
    const response = await exports.default.fetch(
      "https://hsr.ggartifact.com/archive/characters",
      { headers: { Accept: "text/html" } }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, must-revalidate"
    );
    expect(response.headers.has("Location")).toBe(false);
    expect(await response.text()).toContain("<html");
  });

  it.each([
    "/assets/missing.js",
    "/assets/ggstarrail/webp/missing.webp",
    "/media/missing.png",
    "/api/missing",
  ])("keeps %s a 404 for HTML navigations", async (pathname) => {
    const response = await exports.default.fetch(
      `https://hsr.ggartifact.com${pathname}`,
      { headers: { Accept: "text/html" } }
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type") ?? "").not.toContain(
      "text/html"
    );
  });

  it("rejects unapproved origins in the runtime entry point", async () => {
    const response = await exports.default.fetch(
      "https://hsr.ggartifact.com/api/health",
      { headers: { Origin: "https://unapproved.example" } }
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ORIGIN_NOT_ALLOWED" });
  });
});
