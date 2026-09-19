import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { CurrencyWarArchiveContent } from "@/pages/archive/CurrencyWarArchiveView";
import { CurrencyWarCharacterStats } from "@/pages/archive/CurrencyWarCharacterStats";
import {
  CurrencyWarProperties,
  CurrencyWarText,
} from "@/pages/archive/CurrencyWarDetails";
import { CurrencyWarEquipmentRules } from "@/pages/archive/CurrencyWarEquipmentRules";
import { loadCharacters } from "@/providers/gilore/catalog";
import type { CurrencyWarCatalog } from "@/providers/gilore/currencyWar";
import type {
  CurrencyWarEquipment,
  CurrencyWarStarLevel,
  LocalizedText,
  PropertyCatalog,
} from "@/providers/gilore/types";

function localized(en: string, zh: string): LocalizedText {
  return { en: { value: en }, "zh-CN": { value: zh } };
}

function equipment(
  id: string,
  en: string,
  zh: string,
  category = "component"
): CurrencyWarEquipment {
  return {
    id,
    name: localized(en, zh),
    description: localized("Gain #1[i]% ATK.", "攻击力提高#1[i]%。"),
    parameters: [0.2],
    icon_path: "",
    category,
    category_name: localized(
      category === "component" ? "Component" : "Advanced",
      category === "component" ? "基础装备" : "高级装备"
    ),
    kind: "equipment",
    tags: [],
    properties: [],
    recipes: [],
    upgrade_ids: [],
    recommended_character_ids: [],
    season_ids: [1],
    in_handbook: true,
    dress_rule: null,
    dress_rule_parameters: [],
    equip_type: null,
    function: null,
    function_parameters: [],
  };
}

const CATALOG: CurrencyWarCatalog = {
  equipment: [
    equipment("1", "Blade", "利刃"),
    { ...equipment("2", "Crown", "王冠", "advanced"), recipes: [["1", "1"]] },
  ],
  environments: [
    {
      id: "10",
      name: localized("Bull Market", "牛市"),
      description: localized("Gain #1[i] coins.", "获得#1[i]枚金币。"),
      parameters: [8],
      icon_path: "",
      season_ids: [1],
      in_handbook: true,
      remarks: [],
    },
  ],
  strategies: [
    {
      id: "20",
      name: localized("Windfall", "横财"),
      description: localized("Gain #1[i] coins.", "获得#1[i]枚金币。"),
      parameters: [20],
      icon_path: "",
      quality: "Prismatic",
      category_id: 1,
      chapter_limits: [],
      season_ids: [1],
      in_handbook: true,
      remarks: [],
    },
  ],
  bonds: [
    {
      id: "30",
      name: localized("Astral Express", "星穹列车"),
      description: localized("All aboard.", "全员上车。"),
      simple_description: null,
      parameters: [],
      icon_path: "",
      activation_type: "Always",
      type: null,
      season_ids: [1],
      in_handbook: true,
      character_ids: [],
      tiers: [
        {
          required_count: 2,
          quality: null,
          description: localized(
            "Deal #1[i]% bonus damage.",
            "伤害提高#1[i]%。"
          ),
          parameters: [0.15],
          property_description: null,
          property_parameters: [],
          member_properties: [],
          team_properties: [],
        },
      ],
      remarks: [],
      sub_bonds: [
        {
          id: "31",
          name: localized("Together", "同心"),
          description: localized("Hidden searchable effect", "隐藏的协同效果"),
          simple_description: null,
          parameters: [],
          tiers: [],
        },
      ],
    },
  ],
};

const PROPERTIES: PropertyCatalog = {
  schemaVersion: "2.0.0",
  properties: [],
  paths: [],
  combatTypes: [],
  relicSlots: [],
  propertyById: new Map(),
  pathById: new Map(),
  combatTypeById: new Map(),
  relicSlotById: new Map(),
};

function LocaleButton() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("zh-CN")}>
      中文
    </button>
  );
}

function renderArchive(path = "/archive/currency-war", catalog = CATALOG) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <LocaleButton />
        <CurrencyWarArchiveContent
          catalog={catalog}
          characters={[]}
          properties={PROPERTIES}
        />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Currency War archive", () => {
  it("shows localized equipment eligibility and Bond links without exposing source enums", async () => {
    const characters = await loadCharacters();
    const roleOnly = {
      ...equipment("1", "Implant", "植入物"),
      dress_rule: "DressRuleRoleOnly",
      dress_rule_parameters: [1006],
    };
    const emblem = {
      ...equipment("2", "Emblem", "星徽"),
      dress_rule: "DressRuleUniqueAndExclusiveTrait",
      dress_rule_parameters: [30],
    };
    render(
      <I18nProvider>
        <MemoryRouter>
          <CurrencyWarEquipmentRules
            equipment={roleOnly}
            characters={characters.values}
            bonds={CATALOG.bonds}
          />
          <CurrencyWarEquipmentRules
            equipment={emblem}
            characters={characters.values}
            bonds={CATALOG.bonds}
          />
        </MemoryRouter>
      </I18nProvider>
    );
    expect(screen.getByRole("link", { name: "Silver Wolf" })).toHaveAttribute(
      "href",
      "/archive/characters?id=1006"
    );
    expect(
      screen.getByRole("link", { name: "Astral Express" })
    ).toHaveAttribute("href", "/archive/currency-war?tab=bonds&id=30");
    expect(
      screen.getByText("Cannot equip identical Bond Emblems.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/DressRule|RoleOnly|ExclusiveTrait/)
    ).not.toBeInTheDocument();
  });

  it("shows only the selected position's resource stats and formats Lucky Strike ratios", () => {
    const starLevel: CurrencyWarStarLevel = {
      star: 1,
      front_description: null,
      back_description: null,
      front_skills: [],
      back_skills: [],
      servant_skills: [],
      properties: [],
      front_power: 100,
      back_power: 150,
      initial_energy: 0,
      max_energy: 120,
      energy_bar: 3,
      initial_energy_bar: 1,
      luck_chance: 0.05,
      luck_damage: 1,
      heal_base: 60,
      shield_base: 60,
    };
    const { rerender } = render(
      <I18nProvider>
        <CurrencyWarCharacterStats
          starLevel={starLevel}
          position="Back"
          chargeTypes={["EnergyBar", "Speed"]}
        />
      </I18nProvider>
    );
    expect(screen.getByText("Initial Charge")).toBeInTheDocument();
    expect(screen.getByText("Max Charge")).toBeInTheDocument();
    expect(screen.getByText("Charge · SPD")).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    rerender(
      <I18nProvider>
        <CurrencyWarCharacterStats
          starLevel={starLevel}
          position="Front"
          chargeTypes={["EnergyBar", "Speed"]}
        />
      </I18nProvider>
    );
    expect(screen.queryByText("Max Charge")).not.toBeInTheDocument();
    expect(screen.getByText("On-Field Strength")).toBeInTheDocument();
    expect(screen.getByText("Healing Strength")).toBeInTheDocument();
  });
  it("keeps categories with the same raw enum separately filterable and merges duplicate labels", async () => {
    const user = userEvent.setup();
    renderArchive("/archive/currency-war", {
      ...CATALOG,
      equipment: [
        {
          ...equipment("1", "Contract", "合同", "Other"),
          category_name: localized("Employment Contract", "雇佣合同"),
          kind: "consumable",
        },
        {
          ...equipment("2", "Box", "箱子", "Other"),
          category_name: localized("Weapon Box", "装备箱"),
          kind: "forge",
        },
        {
          ...equipment("3", "Mystery", "神秘物品", "Other"),
          category_name: localized("Other", "其他"),
        },
        {
          ...equipment("4", "Token", "代币", "Special"),
          category_name: localized("Other", "其他"),
        },
      ],
    });
    expect(
      screen.getByRole("button", { name: "Employment Contract" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Weapon Box" }));
    expect(screen.getByText("Showing 1 of 4 records")).toBeInTheDocument();
    expect(screen.getByTestId("currency-war-detail")).toHaveTextContent("Box");
    await user.click(screen.getByRole("button", { name: "Weapon Box" }));
    await user.click(screen.getByRole("button", { name: "Other" }));
    expect(screen.getByText("Showing 2 of 4 records")).toBeInTheDocument();
  });

  it("formats mode properties and explicit adaptation percent conventions", () => {
    render(
      <I18nProvider>
        <CurrencyWarProperties
          properties={PROPERTIES}
          values={[
            {
              property_id: "Power",
              value: 12,
              name: localized("Power", "战力"),
              value_kind: "flat",
            },
            {
              property_id: "Luck",
              value: 0.15,
              name: localized("Luck", "幸运"),
              value_kind: "ratio",
            },
          ]}
        />
        <CurrencyWarText
          text={localized("Increase #1 and #2[i]%.", "提高#1和#2[i]%。")}
          parameters={[0.2, 0.35]}
          parameterFormat="[i]%"
        />
      </I18nProvider>
    );
    expect(screen.getByText("Power")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
    expect(screen.getByText("Increase 20% and 35%.")).toBeInTheDocument();
  });
  it("searches both languages, clears conflicting filters for recipes, and keeps selection across locale changes", async () => {
    const user = userEvent.setup();
    renderArchive();
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.type(screen.getByRole("searchbox"), "王冠");
    expect(screen.getByText("Showing 1 of 2 records")).toBeInTheDocument();
    const detail = screen.getByTestId("currency-war-detail");
    expect(
      within(detail).getByRole("heading", { name: "Crown" })
    ).toBeInTheDocument();
    expect(detail).toHaveTextContent("Gain 20% ATK.");
    await user.click(within(detail).getByRole("button", { name: /Blade/ }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Advanced" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText("Showing 2 of 2 records")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("currency-war-detail")).getByRole("heading", {
        name: "Blade",
      })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(
      within(screen.getByTestId("currency-war-detail")).getByRole("heading", {
        name: "利刃",
      })
    ).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "Crown");
    expect(
      within(screen.getByTestId("currency-war-detail")).getByRole("heading", {
        name: "王冠",
      })
    ).toBeInTheDocument();
  });

  it("deep links bonds, searches sub-bonds, supports keyboard tabs and renders the empty state", async () => {
    const user = userEvent.setup();
    renderArchive("/archive/currency-war?tab=bonds&id=30");
    expect(screen.getByRole("tab", { name: /Bonds/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("currency-war-detail")).toHaveTextContent(
      "Deal 15% bonus damage."
    );
    await user.type(screen.getByRole("searchbox"), "隐藏的协同效果");
    expect(screen.getByText("Showing 1 of 1 records")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "no-match");
    expect(screen.queryByTestId("currency-war-detail")).not.toBeInTheDocument();
    screen.getByRole("tab", { name: /Bonds/ }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /Strategies/ })).toHaveFocus();
    expect(screen.getByRole("searchbox")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Prismatic" }));
    expect(screen.getByTestId("currency-war-detail")).toHaveTextContent(
      "Windfall"
    );
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("button", { name: "棱彩" })).toBeInTheDocument();
  });

  it("opens selected records in the narrow-screen sheet and restores trigger focus", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(max-width: 1023px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    renderArchive();
    const trigger = within(
      screen.getByRole("region", { name: "Currency War catalog results" })
    ).getByRole("button", { name: /Crown/ });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Crown" });
    expect(
      within(within(dialog).getByTestId("currency-war-detail")).getByRole(
        "heading",
        { name: "Crown", level: 2 }
      )
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(trigger).toHaveFocus();
  });
});
