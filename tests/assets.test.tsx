import { fireEvent, render, screen } from "@testing-library/react";
import { AssetImage } from "@/components/shared/AssetImage";
import {
  configureCatalogAssetLookup,
  getAssetFallbackDataUrl,
  getAssetUrl,
  resolveCatalogAsset,
} from "@/lib/assets";

const MARCH_7TH_SOURCE_PATH = "SpriteOutput/AvatarIcon/Avatar/1001.png";

beforeEach(() => {
  configureCatalogAssetLookup([]);
});

describe("catalog asset lookup", () => {
  it("resolves generated cache paths without accepting remote URLs", () => {
    configureCatalogAssetLookup([
      {
        kind: "character",
        id: "1001",
        sourcePath: MARCH_7TH_SOURCE_PATH,
        cachePath: "cache/starrailres/icon/avatar/1001.png",
      },
    ]);

    expect(
      resolveCatalogAsset({
        kind: "character",
        id: "1001",
        sourcePath: MARCH_7TH_SOURCE_PATH,
      })
    ).toMatchObject({
      src: "/assets/ggstarrail/cache/starrailres/icon/avatar/1001.png",
      startsWithFallback: false,
    });
    expect(() =>
      configureCatalogAssetLookup([
        {
          kind: "character",
          id: "1001",
          sourcePath: MARCH_7TH_SOURCE_PATH,
          cachePath: "https://example.com/1001.png",
        },
      ])
    ).toThrow("local paths");
  });

  it("resolves rarity variants by their shared source path", () => {
    configureCatalogAssetLookup([
      {
        kind: "relic-piece",
        id: "101:HEAD",
        sourcePath: "SpriteOutput/ItemIcon/RelicIcons/IconRelic_101_1.png",
        cachePath: "cache/starrailres/icon/relic/101_0.png",
      },
    ]);

    expect(
      resolveCatalogAsset({
        kind: "relic-piece",
        id: "31011",
        sourcePath: "SpriteOutput/ItemIcon/RelicIcons/IconRelic_101_1.png",
      })
    ).toMatchObject({
      entry: { id: "101:HEAD" },
      startsWithFallback: false,
    });
  });

  it("uses a deterministic generated image for source-missing assets", () => {
    const ref = { kind: "property" as const, id: "StanceBreakAddedRatio" };
    const first = getAssetFallbackDataUrl(ref);
    expect(first).toBe(getAssetFallbackDataUrl(ref));
    expect(first).toMatch(/^data:image\/svg\+xml,/);
    expect(resolveCatalogAsset(ref)).toMatchObject({
      src: first,
      fallbackSrc: first,
      startsWithFallback: true,
    });
  });

  it("never treats the raw property icon sentinel as a URL", () => {
    configureCatalogAssetLookup([
      {
        kind: "property",
        id: "HPAddedRatio",
        sourcePath: "0",
        cachePath: "cache/gilore/v1/blobs/sha256/property.png",
      },
    ]);

    const resolved = resolveCatalogAsset({
      kind: "property",
      id: "HPAddedRatio",
      sourcePath: "0",
    });
    expect(resolved.src).toBe(
      "/assets/ggstarrail/cache/gilore/v1/blobs/sha256/property.png"
    );
    expect(resolved.src).not.toContain("/0");
    expect(
      resolveCatalogAsset({
        kind: "property",
        id: "StanceBreakAddedRatio",
        sourcePath: "0",
      })
    ).toMatchObject({ startsWithFallback: true });
  });

  it("keeps application asset URLs local and traversal-free", () => {
    expect(getAssetUrl("/assets/ggstarrail/mark.svg")).toBe(
      "/assets/ggstarrail/mark.svg"
    );
    expect(() => getAssetUrl("https://example.com/image.png")).toThrow();
    expect(() => getAssetUrl("assets/../secret")).toThrow();
  });
});

describe("AssetImage", () => {
  it("switches a missing ignored-cache image to a generated fallback", () => {
    configureCatalogAssetLookup([
      {
        kind: "character",
        id: "1001",
        sourcePath: MARCH_7TH_SOURCE_PATH,
        cachePath: "cache/starrailres/icon/avatar/1001.png",
      },
    ]);
    render(
      <AssetImage
        kind="character"
        id="1001"
        sourcePath={MARCH_7TH_SOURCE_PATH}
        alt="March 7th"
      />
    );
    const image = screen.getByRole("img", { name: "March 7th" });
    expect(image).toHaveAttribute("data-asset-source", "local-cache");

    fireEvent.error(image);

    expect(image).toHaveAttribute("data-asset-source", "generated-fallback");
    expect(image.getAttribute("src")).toMatch(/^data:image\/svg\+xml,/);
  });
});
