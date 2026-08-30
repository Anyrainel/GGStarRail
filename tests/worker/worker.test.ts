import { describe, expect, it } from "vitest";
import worker from "../../worker/index";

const env = {
  APP_ID: "ggstarrail-test",
  ALLOWED_ORIGIN: "http://localhost:5173",
};

describe("placeholder Worker", () => {
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

  it("rejects mutations and unknown routes", async () => {
    const mutation = await worker.fetch(
      new Request("https://example.test/api/health", { method: "POST" }),
      env
    );
    const missing = await worker.fetch(
      new Request("https://example.test/api/account"),
      env
    );
    expect(mutation.status).toBe(405);
    expect(missing.status).toBe(404);
  });
});
