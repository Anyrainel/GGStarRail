import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import {
  CharacterSection,
  CharacterSkillCard,
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
  it("never cuts neighboring placeholders or English words into caption fragments", () => {
    const rows = skillComparisonRows(
      `#1[i]%${"amplification ".repeat(5)}#2[f2]% ${"additional damage ".repeat(6)}#3[i]% damage.`
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.caption).not.toMatch(/[#[\]%]/);
      for (const word of row.caption.split(/[\s…]+/).filter(Boolean)) {
        expect(["amplification", "additional", "damage"]).toContain(word);
      }
    }
    const chineseRows = skillComparisonRows(
      `#1[i]%${"对敌方目标造成伤害".repeat(10)}#2[i]%伤害。`
    );
    for (const row of chineseRows) expect(row.caption).not.toMatch(/[#[\]%]/);
  });

  it("compares independently selected levels even when the brief description has no numbers", async () => {
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
    expect(within(table).getByText("50%")).toBeInTheDocument();
    expect(within(table).getByText("70%")).toBeInTheDocument();
    await user.selectOptions(
      within(table).getByRole("combobox", { name: "Comparison level 1" }),
      "2"
    );
    expect(within(table).getByText("60%")).toBeInTheDocument();
    expect(within(table).getByText("70%")).toBeInTheDocument();
    await user.selectOptions(
      within(table).getByRole("combobox", { name: "Comparison level 2" }),
      "1"
    );
    expect(within(table).getByText("50%")).toBeInTheDocument();
    expect(within(table).queryByText("70%")).not.toBeInTheDocument();
    expect(document.querySelectorAll("details details")).toHaveLength(0);
    expect(document.querySelector("details")).toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByText("造成冰属性伤害。")).toBeInTheDocument();
    expect(screen.getByText("战技")).toBeInTheDocument();
    expect(screen.getByText("单攻")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "对比等级1" })).toHaveValue(
      "2"
    );
  });

  it("uses the selected level in full descriptions and derives captions without raw placeholders", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <CharacterSkillCard skill={skill} descriptionMode="full" />
      </I18nProvider>
    );
    expect(
      screen.getByText("Deals 50% Ice DMG. Restores 10 Energy.")
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Comparison level 1" }),
      "3"
    );
    expect(
      screen.getByText("Deals 70% Ice DMG. Restores 14 Energy.")
    ).toBeInTheDocument();
    expect(skillComparisonRows(skill.description.en.value)).toEqual([
      { index: 0, token: "#1[i]%", caption: "Deals … Ice DMG" },
      { index: 1, token: "#2[i]", caption: "Restores … Energy" },
    ]);
  });
});
