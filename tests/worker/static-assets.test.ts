import { describe, expect, it, vi } from "vitest";
import worker from "../../worker/index";

describe("production static asset routing", () => {
  function environment() {
    const fetch = vi.fn(async (request: Request) =>
      new URL(request.url).pathname === "/index.html"
        ? new Response("<html>GGStarRail</html>", {
            headers: { "Content-Type": "text/html" },
          })
        : new Response("Not found", { status: 404 })
    );
    return {
      APP_ID: "ggstarrail",
      ALLOWED_ORIGIN: "https://hsr.ggartifact.com",
      HOYOLAB_CN_PAGE_HASH: "#/hsr",
      ASSETS: { fetch } as unknown as Fetcher,
    };
  }

  it("serves fresh HTML on a direct route navigation", async () => {
    const response = await worker.fetch(
      new Request("https://hsr.ggartifact.com/archive/characters", {
        headers: { Accept: "text/html" },
      }),
      environment()
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, must-revalidate"
    );
    expect(await response.text()).toContain("GGStarRail");
  });

  it.each([
    "/assets/old-chunk.js",
    "/assets/ggstarrail/webp/missing.webp",
    "/api/missing",
  ])("keeps %s a real 404 even for a navigation", async (pathname) => {
    const response = await worker.fetch(
      new Request(`https://hsr.ggartifact.com${pathname}`, {
        headers: { Accept: "text/html" },
      }),
      environment()
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("<html>");
  });

  it("does not serve HTML for POST or a non-navigation fetch", async () => {
    for (const init of [
      { method: "POST", headers: { Accept: "text/html" } },
      {},
    ]) {
      const response = await worker.fetch(
        new Request("https://hsr.ggartifact.com/unknown", init),
        environment()
      );
      expect(response.status).toBe(404);
    }
  });
});
