import { fireEvent, render, screen } from "@testing-library/react";
import { AssetImage } from "@/components/shared/AssetImage";
import {
  configureCatalogAssetLookup,
  getAssetFallbackDataUrl,
  getAssetUrl,
  resolveCatalogAsset,
} from "@/lib/assets/urls";

const MARCH_7TH_SOURCE_PATH = "SpriteOutput/AvatarIcon/Avatar/1001.png";

beforeEach(() => {
  configureCatalogAssetLookup([]);
});

describe("catalog asset lookup", () => {
  it("selects independent artwork variants and keeps existing card defaults", () => {
    configureCatalogAssetLookup([
      {
        kind: "character",
        id: "1001",
        variant: "avatar",
        cachePath: "avatar.webp",
      },
      {
        kind: "character",
        id: "1001",
        variant: "round",
        cachePath: "round.webp",
      },
      {
        kind: "light-cone",
        id: "20001",
        variant: "portrait",
        cachePath: "portrait.webp",
      },
      {
        kind: "light-cone",
        id: "20001",
        variant: "icon",
        cachePath: "icon.webp",
      },
    ]);
    expect(
      resolveCatalogAsset({ kind: "character", id: "1001" }).src
    ).toContain("/avatar.webp");
    expect(
      resolveCatalogAsset({ kind: "character", id: "1001", variant: "round" })
        .src
    ).toContain("/round.webp");
    expect(
      resolveCatalogAsset({ kind: "light-cone", id: "20001" }).src
    ).toContain("/portrait.webp");
    expect(
      resolveCatalogAsset({ kind: "light-cone", id: "20001", variant: "icon" })
        .src
    ).toContain("/icon.webp");
    expect(
      resolveCatalogAsset({
        kind: "character",
        id: "missing",
        variant: "round",
      }).startsWithFallback
    ).toBe(true);
  });

  it("rejects mismatched variants and duplicate default artwork", () => {
    expect(() =>
      configureCatalogAssetLookup([
        {
          kind: "character",
          id: "1001",
          variant: "portrait",
          cachePath: "portrait.webp",
        },
      ])
    ).toThrow("Invalid catalog asset variant");
    expect(() =>
      configureCatalogAssetLookup([
        { kind: "character", id: "1001", cachePath: "avatar.webp" },
        {
          kind: "character",
          id: "1001",
          variant: "avatar",
          cachePath: "other.webp",
        },
      ])
    ).toThrow("Duplicate catalog asset ID");
  });

  it("keeps an unavailable preview avatar separate from its available round icon", () => {
    configureCatalogAssetLookup([
      { kind: "character", id: "1511", variant: "avatar", cachePath: null },
      {
        kind: "character",
        id: "1511",
        variant: "round",
        cachePath: "round.webp",
      },
    ]);
    expect(
      resolveCatalogAsset({ kind: "character", id: "1511" })
    ).toMatchObject({
      startsWithFallback: true,
      entry: { variant: "avatar", cachePath: null },
    });
    expect(
      resolveCatalogAsset({ kind: "character", id: "1511", variant: "round" })
    ).toMatchObject({
      startsWithFallback: false,
      src: "/assets/ggstarrail/round.webp",
    });
  });

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
    expect(getAssetUrl("/logo-hsr.svg")).toBe("/logo-hsr.svg");
    expect(() => getAssetUrl("https://example.com/image.png")).toThrow();
    expect(() => getAssetUrl("assets/../secret")).toThrow();
  });
});

describe("AssetImage", () => {
  it("switches artwork when its variant changes without leaking variant to the DOM", () => {
    configureCatalogAssetLookup([
      {
        kind: "character",
        id: "1001",
        variant: "avatar",
        cachePath: "avatar.webp",
      },
      {
        kind: "character",
        id: "1001",
        variant: "round",
        cachePath: "round.webp",
      },
    ]);
    const { rerender } = render(
      <AssetImage kind="character" id="1001" alt="March 7th" />
    );
    const image = screen.getByRole("img", { name: "March 7th" });
    fireEvent.error(image);
    rerender(
      <AssetImage kind="character" id="1001" variant="round" alt="March 7th" />
    );
    expect(image).toHaveAttribute("src", "/assets/ggstarrail/round.webp");
    expect(image).not.toHaveAttribute("variant");
  });

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
