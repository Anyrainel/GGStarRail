import { beforeAll, describe, expect, it } from "vitest";
import {
  getCombatTypeColor,
  getRarityColor,
  getTierColor,
} from "@/components/shared/colors";
import { combatTypeColor } from "@/lib/gameColors";
import { cn } from "@/lib/utils";
import { buildUiCss, utilityDeclarations } from "./helpers/tailwindCss";

let css: string;
beforeAll(async () => {
  css = await buildUiCss();
});

describe("game colors in compiled Tailwind CSS", () => {
  it("preserves item badge and level strip colors", () => {
    expect(utilityDeclarations(css, "bg-item-badge")["background-color"]).toBe(
      "rgb(74 59 42 / var(--tw-bg-opacity, 1))"
    );
    expect(utilityDeclarations(css, "text-item-badge-foreground").color).toBe(
      "rgb(243 216 140 / var(--tw-text-opacity, 1))"
    );
    expect(utilityDeclarations(css, "bg-item-level")["background-color"]).toBe(
      "rgb(245 240 230 / var(--tw-bg-opacity, 1))"
    );
    expect(utilityDeclarations(css, "text-item-level-foreground").color).toBe(
      "rgb(61 61 61 / var(--tw-text-opacity, 1))"
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
      ).toBe(`rgb(${rgb[index]} / var(--tw-text-opacity, 1))`);
      expect(
        utilityDeclarations(css, getCombatTypeColor(id, "header"))[
          "background-color"
        ]
      ).toBe(`rgb(${headers[index]} / var(--tw-bg-opacity, 1))`);
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
    const foregrounds = [
      "156 163 175",
      "52 211 153",
      "96 165 250",
      "192 132 252",
      "251 191 36",
    ];
    [1, 2, 3, 4, 5].forEach((rarity, index) => {
      expect(
        utilityDeclarations(css, getRarityColor(rarity, "gradient"))[
          "background-image"
        ]
      ).toBe(`linear-gradient(180deg, ${gradients[index]})`);
      expect(
        utilityDeclarations(css, getRarityColor(rarity, "text")).color
      ).toBe(`rgb(${foregrounds[index]} / var(--tw-text-opacity, 1))`);
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

  it("preserves every Tier header and cell opacity", () => {
    const headers = [
      "185 47 58",
      "221 133 89",
      "230 180 77",
      "67 173 139",
      "74 133 205",
      "117 117 117",
    ];
    const backgrounds = [
      "46 12 15",
      "55 33 22",
      "58 45 19",
      "17 43 35",
      "19 33 51",
      "29 29 29",
    ];
    (["S", "A", "B", "C", "D", "Pool"] as const).forEach((tier, index) => {
      expect(
        utilityDeclarations(css, getTierColor(tier, "header"))[
          "background-color"
        ]
      ).toBe(`rgb(${headers[index]} / 0.7)`);
      expect(
        utilityDeclarations(css, getTierColor(tier, "bg"))["background-color"]
      ).toBe(`rgb(${backgrounds[index]} / 0.4)`);
    });
  });
});
