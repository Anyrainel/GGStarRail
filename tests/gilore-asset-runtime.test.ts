import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveCatalogAsset } from "@/lib/assets";
import { loadCatalogAssetLookup } from "@/providers/gilore/assets";

const runtimeLookupPath = path.resolve(
  "public/assets/ggstarrail/cache/gilore/lookup-v1/runtime-lookup.json"
);

describe("lazy GIlore asset runtime adapter", () => {
  it("does not fetch until requested and resolves stable IDs from local cache", async () => {
    const lookup = JSON.parse(fs.readFileSync(runtimeLookupPath, "utf8"));
    const fetchMock = vi.fn(async () => ({
      json: async () => lookup,
      ok: true,
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    await loadCatalogAssetLookup();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/assets/ggstarrail/cache/gilore/lookup-v1/runtime-lookup.json"
    );
    expect(
      resolveCatalogAsset({ kind: "character", id: "1001" })
    ).toMatchObject({ startsWithFallback: false });
    expect(
      resolveCatalogAsset({
        kind: "property",
        id: "StanceBreakAddedRatio",
        sourcePath: "0",
      })
    ).toMatchObject({ startsWithFallback: true });
  });
});
