import { beforeAll, describe, expect, it } from "vitest";
import {
  getCombatTypeColor,
  getRarityColor,
  getTierColor,
} from "@/components/shared/colors";
import { combatTypeColor } from "@/lib/game/colors";
import { cn } from "@/lib/utils";
import { buildUiCss, utilityDeclarations } from "../../helpers/tailwindCss";

let css: string;
beforeAll(async () => {
  css = await buildUiCss();
});

describe("game colors in compiled Tailwind CSS", () => {
  it("preserves item badge and level strip colors", () => {
    expect(utilityDeclarations(css, "bg-item-badge")["background-color"]).toBe(
      "#4a3b2a"
    );
    expect(utilityDeclarations(css, "text-item-badge-foreground").color).toBe(
      "#f3d88c"
    );
    expect(utilityDeclarations(css, "bg-item-level")["background-color"]).toBe(
      "#f5f0e6"
    );
    expect(utilityDeclarations(css, "text-item-level-foreground").color).toBe(
      "#3d3d3d"
    );
  });
  it("merges gradient images independently of solid backgrounds", () => {
    expect(cn("bg-rarity-4", getRarityColor(5, "gradient"))).toBe(
      "bg-rarity-4 bg-rarity-gradient-5"
    );
    expect(
      cn(getRarityColor(4, "gradient"), getRarityColor(5, "gradient"))
    ).toBe("bg-rarity-gradient-5");
    expect(cn("bg-rarity-4", "bg-rarity-5")).toBe("bg-rarity-5");
  });
  it("preserves Combat Type text and dimmed header hues", () => {
    const types = [
      "Physical",
      "Fire",
      "Ice",
      "Thunder",
      "Wind",
      "Quantum",
      "Imaginary",
    ];
    const rgb = [
      "255 255 255",
      "248 78 54",
      "71 199 253",
      "223 83 255",
      "70 222 156",
      "135 128 255",
      "255 235 97",
    ];
    const headers = [
      "107 107 107",
      "90 43 37",
      "43 78 93",
      "86 48 94",
      "41 82 64",
      "65 63 98",
      "95 90 52",
    ];
    types.forEach((id, index) => {
      expect(
        utilityDeclarations(css, getCombatTypeColor(id, "text")).color
      ).toBe(`rgb(${rgb[index]})`);
      expect(
        utilityDeclarations(css, getCombatTypeColor(id, "header"))[
          "background-color"
        ]
      ).toBe(`rgb(${headers[index]})`);
      expect(combatTypeColor(id)).toBe(
        `rgb(${rgb[index].split(" ").join(", ")})`
      );
    });
    for (const id of ["Warrior", "unknown", "toString"]) {
      expect(getCombatTypeColor(id, "header")).toBe("");
      expect(combatTypeColor(id)).toBeUndefined();
    }
  });

  it("keeps the supplied artwork gradients separate from solid rarity accents", () => {
    const gradients = [
      "#3e404e, #88888e",
      "#374760, #44908c",
      "#3a3b62, #4c86c9",
      "#3f4064, #9c65d7",
      "#a35d55, #d0aa6e",
    ];
    const foregrounds = ["#9ca3af", "#34d399", "#60a5fa", "#c084fc", "#fbbf24"];
    [1, 2, 3, 4, 5].forEach((rarity, index) => {
      expect(
        utilityDeclarations(css, getRarityColor(rarity, "gradient"))[
          "background-image"
        ]
      ).toBe(`linear-gradient(180deg, ${gradients[index]})`);
      expect(
        utilityDeclarations(css, getRarityColor(rarity, "text")).color
      ).toBe(foregrounds[index]);
      expect(
        utilityDeclarations(css, getRarityColor(rarity, "bg"))[
          "background-image"
        ]
      ).toBeUndefined();
    });
    expect(
      utilityDeclarations(css, getRarityColor(null, "gradient"))[
        "background-image"
      ]
    ).toBe("linear-gradient(180deg, hsl(var(--muted)), hsl(var(--secondary)))");
    expect(getRarityColor(99, "gradient")).toBe(getRarityColor(1, "gradient"));
  });

  it("keeps theme colors and surfaces bound to the selected runtime palette", () => {
    expect(utilityDeclarations(css, "bg-background")["background-color"]).toBe(
      "hsl(var(--background))"
    );
    expect(utilityDeclarations(css, "text-primary").color).toBe(
      "hsl(var(--primary))"
    );
    for (const surface of ["page", "card", "select"]) {
      expect(
        utilityDeclarations(css, `bg-gradient-${surface}`)["background-image"]
      ).toBe(`var(--gradient-${surface})`);
    }
    expect(utilityDeclarations(css, "rounded-sm")["border-radius"]).toBe(
      "calc(var(--radius) - 4px)"
    );
    expect(utilityDeclarations(css, "rounded-[4px]")["border-radius"]).toBe(
      "4px"
    );
    expect(css).toContain("height: var(--radix-accordion-content-height)");
    expect(css).toContain("animation: var(--animate-accordion-down)");
    expect(css).toContain("animation: var(--animate-accordion-up)");
  });

  it("preserves every Tier header and cell opacity", () => {
    const headers = [
      "#b92f3a",
      "#dd8559",
      "#e6b44d",
      "#43ad8b",
      "#4a85cd",
      "#757575",
    ];
    const backgrounds = [
      "#2e0c0f",
      "#372116",
      "#3a2d13",
      "#112b23",
      "#132133",
      "#1d1d1d",
    ];
    (["S", "A", "B", "C", "D", "Pool"] as const).forEach((tier, index) => {
      expect(
        utilityDeclarations(css, getTierColor(tier, "header"))[
          "background-color"
        ]
      ).toBe(`color-mix(in oklab, ${headers[index]} 70%, transparent)`);
      expect(
        utilityDeclarations(css, getTierColor(tier, "bg"))["background-color"]
      ).toBe(`color-mix(in oklab, ${backgrounds[index]} 40%, transparent)`);
    });
  });
});
