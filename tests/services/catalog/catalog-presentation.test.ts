import { beforeAll, describe, expect, it } from "vitest";
import { setReferenceLocale } from "@/config/referenceLocale";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import {
  characterCatalogPresentation,
  formatAccountStatValue,
  localizedPropertyName,
} from "@/services/catalog/presentation";

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
  it.each([
    ["HPDelta", 38.103755, "38"],
    ["AttackDelta", 19.051877, "19"],
    ["SpeedDelta", 2.6, "2"],
    ["CriticalChanceBase", 3.2400000000000002, "3.2%"],
    ["CriticalDamageBase", 6.48, "6.4%"],
    ["HPAddedRatio", 43.2, "43.2%"],
  ])("formats %s using equipment panel precision", (id, value, expected) => {
    const property = references.properties.propertyById.get(id);
    expect(property).toBeDefined();
    expect(formatAccountStatValue(value, property, "en")).toBe(expected);
    expect(formatAccountStatValue(value, property, "zh-CN")).toBe(expected);
  });
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

  it("disambiguates flat and ratio properties from value_kind", async () => {
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
    setReferenceLocale("zh-CN");
    const chinese = await loadBuildReferences();
    expect(
      localizedPropertyName("DefenceDelta", chinese.properties, "zh-CN")
    ).toBe("防御力");
    expect(
      localizedPropertyName("DefenceAddedRatio", chinese.properties, "zh-CN")
    ).toBe("防御力%");
  });
});
