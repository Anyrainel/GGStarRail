import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { formatGameTextVariants } from "@/lib/gameTextVariants";
import {
  CharacterSection,
  CharacterSkillCard,
  defaultSkillComparisonLevels,
  skillComparisonPlan,
  skillComparisonRows,
} from "@/pages/archive/CharacterSkillCard";
import type { LocalizedText } from "@/providers/gilore/types";

vi.mock("@/providers/gilore/catalog", () => ({
  getLocalizedValue: (
    text: LocalizedText | null | undefined,
    locale: "en" | "zh-CN"
  ) => text?.[locale].value ?? null,
}));
const text = (en: string, zh = en): LocalizedText => ({
  en: { value: en },
  "zh-CN": { value: zh },
});
const skill = {
  id: "140202",
  name: text("Thorned Snare", "荆棘陷阱"),
  type_description: text("Skill", "战技"),
  tag: text("Single Target", "单攻"),
  description: text(
    "Deals <color=#ffee99>#1[i]%</color> Ice DMG. Restores #2[i] Energy.",
    "造成#1[i]%的冰属性伤害。恢复#2[i]点能量。"
  ),
  simple_description: text("Deals Ice DMG.", "造成冰属性伤害。"),
  normal_max_level: 2,
  max_level: 3,
  levels: [
    { level: 1, parameters: [0.5, 10], simple_parameters: [] },
    { level: 2, parameters: [0.6, 12], simple_parameters: [] },
    { level: 3, parameters: [0.7, 14], simple_parameters: [] },
  ],
};

function LocaleControl() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("zh-CN")}>
      中文
    </button>
  );
}

describe("Character skill comparisons", () => {
  it("maps brief references by complete value series and preserves ambiguous or unmatched parameters", () => {
    const levels = [
      {
        level: 1,
        parameters: [0.5, 10, 2, 2],
        simple_parameters: [10, 0.5, 2, 7],
      },
      {
        level: 2,
        parameters: [0.7, 20, 2, 2],
        simple_parameters: [20, 0.7, 2, 9],
      },
    ];
    const plan = skillComparisonPlan(
      "#1[i]% DMG; #2[i] Energy; #3[i] stacks; #4[i] turns.",
      "#1[i] Energy, #2[i]% DMG, #3[i] turns and #4[i] hits.",
      levels,
      true
    );
    expect([...plan.descriptionNumbers.values()]).toEqual([2, 1, 5, 6]);
    expect(plan.rows.slice(-2).map((row) => row.source)).toEqual([
      "simple",
      "simple",
    ]);
    const percentMismatch = skillComparisonPlan(
      "#1[i]% DMG",
      "#1[i] points",
      [{ level: 1, parameters: [0.5], simple_parameters: [0.5] }],
      true
    );
    expect(percentMismatch.descriptionNumbers.get("#1[i]")).toBe(2);
  });
  it("defaults to attainable normal and Eidolon caps, or level one against the normal cap", () => {
    expect(defaultSkillComparisonLevels(skill)).toEqual([2, 3]);
    expect(
      defaultSkillComparisonLevels({ ...skill, normal_max_level: 3 })
    ).toEqual([1, 3]);
    const levels = Array.from({ length: 12 }, (_, index) => ({
      level: index + 1,
      parameters: [],
    }));
    expect(
      defaultSkillComparisonLevels({
        ...skill,
        levels,
        normal_max_level: 6,
        max_level: 7,
      })
    ).toEqual([6, 7]);
    expect(
      defaultSkillComparisonLevels({
        ...skill,
        levels,
        normal_max_level: 10,
        max_level: 12,
      })
    ).toEqual([10, 12]);
    expect(
      defaultSkillComparisonLevels({
        ...skill,
        levels,
        normal_max_level: 10,
        max_level: 10,
      })
    ).toEqual([1, 10]);
  });

  it("keeps comparisons in brief mode and selects levels through the shared dropdown", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <CharacterSection title="Skills">
          <CharacterSkillCard skill={skill} descriptionMode="short" />
        </CharacterSection>
        <LocaleControl />
      </I18nProvider>
    );
    expect(screen.getByText("Deals Ice DMG.")).toBeInTheDocument();
    expect(screen.getByText("Single Target")).toBeInTheDocument();
    expect(screen.queryByText("140202")).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Skill values" });
    expect(within(table).getByText("60%")).toBeInTheDocument();
    expect(within(table).getByText("70%")).toBeInTheDocument();
    expect(within(table).getByText("70%")).not.toHaveClass("text-primary");
    await user.click(
      within(table).getByRole("combobox", { name: "Comparison level 1" })
    );
    await user.click(screen.getByRole("option", { name: "Level 1" }));
    expect(within(table).getByText("50%")).toBeInTheDocument();
    expect(within(table).getByText("70%")).toBeInTheDocument();
    await user.click(
      within(table).getByRole("combobox", { name: "Comparison level 2" })
    );
    await user.click(screen.getByRole("option", { name: "Level 2" }));
    expect(within(table).getByText("60%")).toBeInTheDocument();
    expect(within(table).queryByText("70%")).not.toBeInTheDocument();
    expect(document.querySelectorAll("details details")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByText("造成冰属性伤害。")).toBeInTheDocument();
    expect(screen.getByText("战技")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "对比等级1" })
    ).toHaveTextContent("1");
  });

  it("uses matching numbered description markers and table rows without prefilling values", () => {
    const { container } = render(
      <I18nProvider>
        <CharacterSkillCard skill={skill} descriptionMode="full" />
      </I18nProvider>
    );
    const description = container.querySelector("article p")!;
    expect(description).toHaveTextContent(
      "Deals 1 Ice DMG. Restores 2 Energy."
    );
    expect(description).not.toHaveTextContent(/50%|60%|70%|#|\[i\]/);
    expect(
      within(screen.getByRole("table")).getByTitle("Value 1")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByTitle("Value 2")
    ).toBeInTheDocument();
    expect(skillComparisonRows(skill.description.en.value)).toEqual([
      { index: 0, token: "#1[i]%", number: 1 },
      { index: 1, token: "#2[i]", number: 2 },
    ]);
  });

  it("shows star variants in one value column when a skill has a single combat level", () => {
    render(
      <I18nProvider>
        <CharacterSkillCard
          skill={{
            ...skill,
            normal_max_level: 1,
            max_level: 1,
            levels: skill.levels.slice(0, 1),
          }}
          descriptionMode="full"
          comparisonVariants={[
            { label: "1★", levels: [{ level: 1, parameters: [0.5, 10] }] },
            { label: "2★", levels: [{ level: 1, parameters: [0.6, 10] }] },
          ]}
        />
      </I18nProvider>
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("1★ / 2★")).toBeInTheDocument();
    expect(screen.getByText("50/60%")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});

describe("Game effect variant formatting", () => {
  it("formats native templates with ordered Superimposition values and shared suffixes", () => {
    const variants = [0.12, 0.15, 0.18, 0.21, 0.24].map((value) => ({
      parameters: [value, 3],
    }));
    expect(
      formatGameTextVariants(
        "Gain #1[i]% CRIT Rate for #2[i] turns.",
        variants,
        "Trailblazer"
      )
    ).toBe("Gain 12/15/18/21/24% CRIT Rate for 3 turns.");
    expect(
      formatGameTextVariants(
        "暴击率提高#1[i]%，持续#2[i]回合。",
        variants,
        "开拓者"
      )
    ).toBe("暴击率提高12/15/18/21/24%，持续3回合。");
  });
});
