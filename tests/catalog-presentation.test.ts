import { beforeAll, describe, expect, it } from "vitest";
import type { BuildReferences } from "@/lib/buildReferences";
import { loadBuildReferences } from "@/lib/buildReferences";
import {
  characterCatalogPresentation,
  localizedPropertyName,
} from "@/lib/catalogPresentation";

let references: BuildReferences;

beforeAll(async () => {
  references = await loadBuildReferences();
});

function character(id: string) {
  const definition = references.characters.byId.get(id);
  if (!definition) throw new Error(`Missing Character ${id}`);
  return definition;
}

describe("build catalog presentation", () => {
  it("disambiguates legitimate Character forms with Path and Combat Type", () => {
    const preservationMarch = characterCatalogPresentation(
      character("1001"),
      references.properties,
      "en",
      "Trailblazer"
    );
    const huntMarch = characterCatalogPresentation(
      character("1224"),
      references.properties,
      "en",
      "Trailblazer"
    );

    expect(preservationMarch.name).toBe("March 7th");
    expect(huntMarch.name).toBe("March 7th");
    expect(preservationMarch.label).toBe("March 7th · Preservation · Ice");
    expect(huntMarch.label).toBe("March 7th · The Hunt · Imaginary");
  });

  it("names every Trailblazer form without exposing raw ids or nickname tokens", () => {
    const caelus = characterCatalogPresentation(
      character("8001"),
      references.properties,
      "en",
      "Trailblazer"
    );
    const stelle = characterCatalogPresentation(
      character("8010"),
      references.properties,
      "en",
      "Trailblazer"
    );

    expect(caelus.label).toBe("Trailblazer · Caelus · Destruction · Physical");
    expect(stelle.label).toBe("Trailblazer · Stelle · Elation · Lightning");
    expect(`${caelus.label} ${stelle.label}`).not.toMatch(
      /\{NICKNAME\}|8001|8010/
    );
  });

  it("strips game markup from catalog names", () => {
    const silverWolf = characterCatalogPresentation(
      character("1506"),
      references.properties,
      "en",
      "Trailblazer"
    );

    expect(silverWolf.name).toBe("Silver Wolf LV.999");
    expect(silverWolf.label).toBe("Silver Wolf LV.999 · Elation · Imaginary");
    expect(silverWolf.label).not.toContain("<unbreak>");
  });

  it("disambiguates flat and ratio properties from value_kind", () => {
    expect(localizedPropertyName("HPDelta", references.properties, "en")).toBe(
      "HP"
    );
    expect(
      localizedPropertyName("HPAddedRatio", references.properties, "en")
    ).toBe("HP%");
    expect(
      localizedPropertyName("AttackDelta", references.properties, "en")
    ).toBe("ATK");
    expect(
      localizedPropertyName("AttackAddedRatio", references.properties, "en")
    ).toBe("ATK%");
    expect(
      localizedPropertyName("DefenceDelta", references.properties, "zh-CN")
    ).toBe("防御力");
    expect(
      localizedPropertyName("DefenceAddedRatio", references.properties, "zh-CN")
    ).toBe("防御力%");
  });
});
