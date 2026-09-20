import { describe, expect, it } from "vitest";
import {
  currencyWarSkillGroups,
  currencyWarSkillLevelCaps,
  formatStarValues,
} from "@/lib/currencyWarPresentation";
import { formatGameTextVariants } from "@/lib/gameTextVariants";
import { loadCharacters } from "@/providers/reference/catalog";

describe("Currency War star comparisons", () => {
  it("preserves every star, combat level, and condition parameter when skill IDs change", async () => {
    const catalog = await loadCharacters();
    const welt = catalog.byId.get("1004")!.currency_war[0];
    const groups = currencyWarSkillGroups(welt.star_levels, "front_skills");
    expect(groups).toHaveLength(3);
    const effect = groups[0];
    expect(
      new Set(effect.variants.map((entry) => entry.skill.id)).size
    ).toBeGreaterThan(1);
    expect(effect.variants.map((entry) => entry.star)).toEqual([1, 2, 3]);
    expect(
      formatGameTextVariants(
        "#1[i]%",
        effect.variants.map(({ skill }) => ({ parameters: skill.parameters })),
        "Trailblazer"
      )
    ).toBe("150/187.5/750%");
    expect(
      groups[1].variants.every((entry) => entry.skill.levels.length === 15)
    ).toBe(true);
    expect(
      currencyWarSkillLevelCaps(
        groups[2].skill,
        catalog.byId.get("1004")!.skills
      )
    ).toEqual({ normal_max_level: 10, max_level: 12 });
    const march = catalog.byId.get("1001")!.currency_war[0];
    const back = currencyWarSkillGroups(march.star_levels, "back_skills");
    expect(
      new Set(
        back[0].variants.map((entry) =>
          JSON.stringify(entry.skill.condition_parameters)
        )
      ).size
    ).toBeGreaterThan(1);
  });

  it("keeps changed authored effects separate rather than dropping later-star text", async () => {
    const catalog = await loadCharacters();
    const role = catalog.byId.get("1317")!.currency_war[0];
    const groups = currencyWarSkillGroups(role.star_levels, "front_skills");
    expect(
      groups.map((group) => group.variants.map((entry) => entry.star))
    ).toEqual([[1, 2, 3], [4]]);
    expect(groups[1].skill.description.en.value).not.toEqual(
      groups[0].skill.description.en.value
    );
  });

  it("collapses constants, retains missing-star slots, and writes a single percent suffix", () => {
    expect(formatStarValues([0.6, 1.2, 2, 3], "ratio")).toBe("60/120/200/300%");
    expect(formatStarValues([2, 2, 2])).toBe("2");
    expect(formatStarValues([2, null, 4])).toBe("2/—/4");
  });
});
