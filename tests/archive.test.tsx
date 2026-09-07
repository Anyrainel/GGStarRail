import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { setBetaEnabled } from "@/data/betaState";
import { I18nProvider } from "@/i18n/I18nContext";

const asyncCatalogOptions = { timeout: 15_000 };

function renderArchive(path: string) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

async function catalogRegion(name: string, expectedCards: number) {
  const region = await screen.findByRole(
    "region",
    { name },
    asyncCatalogOptions
  );
  expect(within(region).getAllByRole("button")).toHaveLength(expectedCards);
  return region;
}

async function switchLocale(
  user: ReturnType<typeof userEvent.setup>,
  name: "EN" | "中文"
) {
  await user.click(screen.getByRole("button", { name: /^(More|更多)$/ }));
  await user.click(
    await screen.findByRole("menuitemradio", {
      name: name === "EN" ? "English" : "简体中文",
    })
  );
}

function closestElement(element: HTMLElement, selector: string) {
  const closest = element.closest<HTMLElement>(selector);
  if (!closest) throw new Error(`${selector} ancestor was not rendered`);
  return closest;
}

function queryElement(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`${selector} was not rendered`);
  return element;
}

function catalogItem(
  container: HTMLElement,
  kind: "character" | "light-cone" | "relic-set",
  id: string
) {
  return queryElement(container, `[data-${kind}-id="${id}"]`);
}

describe("Archive catalogs", () => {
  beforeEach(() => setBetaEnabled(true));

  it("shows only verified Light Cones and no source previews by default", async () => {
    setBetaEnabled(false);
    renderArchive(APP_PATHS.archiveLightCones);
    await catalogRegion("Light Cone catalog results", 166);
    expect(screen.queryByText("Source previews")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Hide unreleased content")
    ).not.toBeInTheDocument();
  });
  it("loads each complete catalog through the route-local async boundary", async () => {
    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveCharacters);

    await catalogRegion("Character catalog results", 93);
    expect(screen.getByText("Showing 93 of 93 records")).toBeInTheDocument();
    const catalogDataSummary = screen.getByText("About the catalog data", {
      selector: "summary",
    });
    const catalogDataDisclosure = closestElement(catalogDataSummary, "details");
    expect(catalogDataDisclosure).not.toHaveAttribute("open");
    await user.click(catalogDataSummary);
    expect(
      screen.getByText(
        "93 Characters · 166 Light Cones · 58 sets · 180 logical pieces across 726 rarity variants"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Achievement data · 1760 records in 9 categories · 781 reveal their title only after completion · 280 use an alternate pre-completion description · release version supplied for 0 records"
      )
    ).toBeInTheDocument();

    let tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(
      within(tabs).getByRole("link", { name: "Light Cone Archive" })
    );
    await catalogRegion("Light Cone catalog results", 169);
    expect(screen.getByText("Showing 169 of 169 records")).toBeInTheDocument();

    tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(within(tabs).getByRole("link", { name: "Relic Archive" }));
    await catalogRegion("Relic and Planar set catalog results", 60);
    expect(
      screen.getByText(
        "Showing 60 of 60 sets · 184 logical pieces · 742 rarity variants"
      )
    ).toBeInTheDocument();
  });

  it("searches Characters across locales and combines canonical filters with selection", async () => {
    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveCharacters);
    const region = await catalogRegion("Character catalog results", 93);
    const search = screen.getByRole("searchbox", { name: "Search" });

    await user.type(search, "Trailblazer");
    expect(
      await screen.findByText("Showing 12 of 93 records")
    ).toBeInTheDocument();
    const trailblazer = catalogItem(region, "character", "8001");
    expect(trailblazer).toHaveTextContent("Trailblazer · Caelus");
    expect(trailblazer).not.toHaveTextContent("8001");
    expect(trailblazer).not.toHaveAccessibleName(/8001/);
    expect(trailblazer).not.toHaveTextContent("{NICKNAME}");
    expect(
      queryElement(trailblazer, '[data-item-icon-kind="character"]')
    ).toHaveAttribute("data-item-rarity", "5");
    await user.click(trailblazer);
    let detail = screen.getByTestId("character-detail");
    expect(
      queryElement(detail, '[data-item-icon-kind="character"]')
    ).toHaveAttribute("data-item-rarity", "5");
    expect(detail).toHaveTextContent("A girl/boy who boarded");
    expect(detail).not.toHaveTextContent("{F#");
    expect(detail).not.toHaveTextContent("{M#");

    await user.clear(search);
    await user.type(search, "开拓者");
    expect(
      await screen.findByText("Showing 12 of 93 records")
    ).toBeInTheDocument();
    expect(catalogItem(region, "character", "8010")).toHaveTextContent(
      "Trailblazer · Stelle"
    );

    await user.clear(search);
    await user.type(search, "三月七");
    expect(
      await screen.findByText("Showing 2 of 93 records")
    ).toBeInTheDocument();
    expect(within(region).getAllByRole("button")).toHaveLength(2);

    const huntMarch = catalogItem(region, "character", "1224");
    expect(huntMarch).toHaveTextContent("The Hunt");
    expect(huntMarch).toHaveTextContent("Imaginary");
    expect(huntMarch).not.toHaveTextContent("Rogue");
    await user.click(huntMarch);
    expect(huntMarch).toHaveAttribute("aria-pressed", "true");
    detail = closestElement(
      screen.getByRole("heading", { level: 2, name: "March 7th" }),
      "aside"
    );
    expect(within(detail).getByText("The Hunt")).toBeInTheDocument();
    expect(within(detail).getByText("Imaginary")).toBeInTheDocument();
    expect(detail).toHaveTextContent("March 7th, the Apex Heroine");
    expect(detail).not.toHaveTextContent("<unbreak>");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Path" }),
      "Knight"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Combat Type" }),
      "Ice"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Rarity" }),
      "4"
    );
    expect(
      await screen.findByText("Showing 1 of 93 records")
    ).toBeInTheDocument();
    expect(catalogItem(region, "character", "1001")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await switchLocale(user, "中文");
    expect(
      screen.getByRole("heading", { level: 1, name: "角色图鉴" })
    ).toBeInTheDocument();
    detail = closestElement(
      screen.getByRole("heading", { level: 2, name: "三月七" }),
      "aside"
    );
    expect(within(detail).getByText("存护")).toBeInTheDocument();
    expect(within(detail).getByText("冰")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "March 7th");
    expect(await screen.findByText("显示 1 / 93 条记录")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "命途" }),
      "all"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "战斗属性" }),
      "all"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "稀有度" }),
      "all"
    );
    await user.clear(search);
    await user.type(search, "开拓者");
    expect(await screen.findByText("显示 12 / 93 条记录")).toBeInTheDocument();
    expect(catalogItem(region, "character", "8010")).toHaveTextContent(
      "开拓者 · 星"
    );
  }, 15_000);

  it("searches localized Light Cone effects without changing canonical filters", async () => {
    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveLightCones);
    const region = await catalogRegion("Light Cone catalog results", 169);
    const search = screen.getByRole("searchbox", { name: "Search" });

    await user.type(search, "锋镝");
    expect(
      await screen.findByText("Showing 1 of 169 records")
    ).toBeInTheDocument();
    expect(catalogItem(region, "light-cone", "20000")).toHaveTextContent(
      "Arrows"
    );
    expect(
      queryElement(
        catalogItem(region, "light-cone", "20000"),
        '[data-item-icon-kind="light-cone"]'
      )
    ).toHaveAttribute("data-item-rarity", "3");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Path" }),
      "Rogue"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Rarity" }),
      "3"
    );

    let detail = closestElement(
      screen.getByRole("heading", { level: 2, name: "Arrows" }),
      "aside"
    );
    expect(
      queryElement(detail, '[data-item-icon-kind="light-cone"]')
    ).toHaveAttribute("data-item-rarity", "3");
    expect(
      within(detail).getByRole("heading", { level: 3, name: "Crisis" })
    ).toBeInTheDocument();
    expect(within(detail).getByText("Up to S5")).toBeInTheDocument();
    const superimpositions = within(detail).getByTestId(
      "light-cone-superimpositions"
    );
    expect(
      superimpositions.querySelector('[data-superimposition-level="1"]')
    ).toBeInTheDocument();
    expect(
      superimpositions.querySelector('[data-superimposition-level="5"]')
    ).toBeInTheDocument();

    await switchLocale(user, "中文");
    detail = closestElement(
      screen.getByRole("heading", { level: 2, name: "锋镝" }),
      "aside"
    );
    expect(
      within(detail).getByRole("heading", { level: 3, name: "危机" })
    ).toBeInTheDocument();
    expect(within(detail).getByText("最高叠影 5")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "Crisis");
    expect(await screen.findByText("显示 1 / 169 条记录")).toBeInTheDocument();
  });

  it("exposes the complete 1.1 Character model as separate collapsed records", async () => {
    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveCharacters);
    const region = await catalogRegion("Character catalog results", 93);
    const catalogDataSummary = screen.getByText("About the catalog data", {
      selector: "summary",
    });
    expect(closestElement(catalogDataSummary, "details")).not.toHaveAttribute(
      "open"
    );
    await user.click(catalogDataSummary);
    expect(
      screen.getByText(
        "1.1+ detail model · 611 base skills · 558 Eidolons · 1699 Trace nodes · 7 Servants · 0 seasonal variants · 830 Superimposition rows · 237 progression items"
      )
    ).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Search" });

    await user.type(search, "March 7th");
    await user.click(catalogItem(region, "character", "1001"));
    let detail = screen.getByTestId("character-detail");

    const baseSkills = within(detail).getByTestId("character-base-skills");
    expect(baseSkills).not.toHaveAttribute("open");
    await user.click(
      within(baseSkills).getByText("Skills (6)", {
        selector: "summary",
      })
    );
    const fallbackSkill = queryElement(baseSkills, '[data-skill-id="100106"]');
    await user.click(queryElement(fallbackSkill, "summary"));
    expect(fallbackSkill).toHaveTextContent("Attack");
    expect(fallbackSkill).toHaveTextContent(
      "No simple description exists; this display summary honestly falls back to the primary source's full description."
    );
    expect(fallbackSkill).toHaveTextContent("Level rows (1)");
    expect(fallbackSkill).not.toHaveTextContent("<unbreak>");

    const eidolons = within(detail).getByTestId("character-eidolons");
    expect(eidolons).not.toHaveAttribute("open");
    await user.click(
      within(eidolons).getByText("Eidolons (6)", { selector: "summary" })
    );
    const firstEidolon = queryElement(eidolons, '[data-rank-id="100101"]');
    await user.click(queryElement(firstEidolon, "summary"));
    expect(firstEidolon).toHaveTextContent("E1 · Memory of You");
    expect(firstEidolon).toHaveTextContent("6 Energy");
    expect(firstEidolon).toHaveTextContent("Parameters: 6");
    const eidolonItem = queryElement(firstEidolon, '[data-item-id="11001"]');
    expect(eidolonItem).toHaveTextContent("March 7th: Preservation's Eidolon");
    expect(eidolonItem).toHaveTextContent("11001");
    await user.click(
      within(eidolonItem).getByText("Item-name provenance", {
        selector: "summary",
      })
    );
    expect(eidolonItem).toHaveTextContent(
      "8cdb905dc2f8e6fffa9be4eb07af3e34435d6091"
    );
    expect(eidolonItem).toHaveTextContent("TextMap/TextMapEN.json");

    const traces = within(detail).getByTestId("character-traces");
    expect(traces).not.toHaveAttribute("open");
    await user.click(
      within(traces).getByText("Traces (18)", {
        selector: "summary",
      })
    );
    const defenceTrace = queryElement(traces, '[data-trace-id="1001202"]');
    await user.click(queryElement(defenceTrace, "summary"));
    expect(defenceTrace).toHaveTextContent("DEF Boost");
    expect(defenceTrace).toHaveTextContent("1001101");
    expect(defenceTrace).toHaveTextContent("Properties (1)");
    expect(defenceTrace).toHaveTextContent("DEF");
    expect(defenceTrace).toHaveTextContent("5%");
    expect(defenceTrace).toHaveTextContent("Credit");
    expect(defenceTrace).toHaveTextContent("2");

    const characterExperience = within(detail).getByText(
      "Character EXP items (3)",
      { selector: "summary" }
    );
    await user.click(characterExperience);
    const travelEncounters = queryElement(
      closestElement(characterExperience, "details"),
      '[data-item-id="211"]'
    );
    expect(travelEncounters).toHaveTextContent("Travel Encounters");
    expect(travelEncounters).toHaveTextContent("1000 Character EXP");

    await switchLocale(user, "中文");
    detail = screen.getByTestId("character-detail");
    expect(detail).toHaveTextContent("记忆中的你");
    expect(detail).toHaveTextContent("【三月七•存护】的星魂");
    await switchLocale(user, "EN");
    detail = screen.getByTestId("character-detail");

    await user.clear(search);
    await user.type(search, "Garmentmaker");
    expect(
      await screen.findByText("Showing 2 of 93 records")
    ).toBeInTheDocument();
    await user.click(catalogItem(region, "character", "1402"));
    detail = screen.getByTestId("character-detail");
    expect(
      within(detail).getByTestId("character-base-skills")
    ).toHaveTextContent("Skills (7)");
    const servants = within(detail).getByTestId("character-servants");
    await user.click(
      within(servants).getByText("Servants (1)", {
        selector: "summary",
      })
    );
    expect(servants).toHaveTextContent(
      "Servants remain separate source records"
    );
    const garmentmaker = queryElement(servants, '[data-servant-id="11402"]');
    await user.click(queryElement(garmentmaker, "summary"));
    expect(garmentmaker).toHaveTextContent("Garmentmaker · 11402");
    const servantSkill = queryElement(
      garmentmaker,
      '[data-skill-id="1140201"]'
    );
    expect(servantSkill).toHaveTextContent("Thorned Snare");
    expect(servantSkill).toHaveTextContent("AvatarServantSkillConfig");

    await user.clear(search);
    await user.type(search, "Weightless");
    await user.click(catalogItem(region, "character", "1004"));
    detail = screen.getByTestId("character-detail");
    expect(
      within(detail).getByTestId("character-base-skills")
    ).toHaveTextContent("Skills (6)");
    const enhancements = within(detail).getByTestId("character-enhancements");
    await user.click(
      within(enhancements).getByText(
        "Seasonal enhancements (1 separate variants)",
        { selector: "summary" }
      )
    );
    expect(enhancements).toHaveTextContent(
      "These activity-bound variants stay separate from the base Character."
    );
    const variant = within(enhancements).getByTestId("enhancement-variant-1");
    await user.click(queryElement(variant, "summary"));
    expect(variant).toHaveTextContent(
      "Season 3 · Activity 50100 · Enhanced ID 1"
    );
    expect(variant).toHaveTextContent("6 skills · 6 Eidolons · 18 Trace nodes");
    expect(variant).toHaveTextContent("Variant skills (6)");
    expect(variant).toHaveTextContent("Variant Eidolons (6)");
    expect(variant).toHaveTextContent("Variant Traces (18)");
    expect(variant).toHaveTextContent("Skill changes (3)");
    expect(variant).toHaveTextContent("Trace changes (3)");
    expect(variant).toHaveTextContent("Eidolon changes (3)");
    expect(within(variant).getAllByText("Before")).toHaveLength(12);
    expect(within(variant).getAllByText("After")).toHaveLength(12);

    await user.clear(search);
    await user.type(search, "set up Trailblazer to absorb");
    expect(
      await screen.findByText("Showing 1 of 93 records")
    ).toBeInTheDocument();
    await user.click(catalogItem(region, "character", "1005"));
    detail = screen.getByTestId("character-detail");
    expect(detail).toHaveTextContent("set up Trailblazer to absorb");
    expect(detail).not.toHaveTextContent("{NICKNAME}");
    await switchLocale(user, "中文");
    detail = screen.getByTestId("character-detail");
    expect(detail).toHaveTextContent("令开拓者吸收星核");
    expect(detail).not.toHaveTextContent("{NICKNAME}");
  }, 15_000);

  it("exposes every Light Cone superimposition and resolved progression row", async () => {
    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveLightCones);
    const region = await catalogRegion("Light Cone catalog results", 169);
    const search = screen.getByRole("searchbox", { name: "Search" });

    await user.type(search, "Lil' Twisty Bubble Gum");
    await waitFor(() => {
      expect(within(region).getAllByRole("button").length).toBeLessThan(169);
      expect(catalogItem(region, "light-cone", "22000")).toBeInTheDocument();
    });
    await user.click(catalogItem(region, "light-cone", "22000"));
    let detail = screen.getByTestId("light-cone-detail");

    const superimpositions = within(detail).getByTestId(
      "light-cone-superimpositions"
    );
    expect(superimpositions).not.toHaveAttribute("open");
    await user.click(
      within(superimpositions).getByText("Superimpositions (5)", {
        selector: "summary",
      })
    );
    const s1 = queryElement(
      superimpositions,
      '[data-superimposition-level="1"]'
    );
    await user.click(queryElement(s1, "summary"));
    expect(s1).toHaveTextContent("S1 · Quick on the Draw");
    expect(s1).toHaveTextContent(
      "Increases the wearer's Effect Hit Rate by 20%"
    );
    expect(s1).toHaveTextContent("Parameters: 0.2 · 4");
    expect(s1).toHaveTextContent("StatusProbabilityBase");
    expect(s1).toHaveTextContent("20%");
    expect(s1).toHaveTextContent("Ability22000");
    const s5 = queryElement(
      superimpositions,
      '[data-superimposition-level="5"]'
    );
    await user.click(queryElement(s5, "summary"));
    expect(s5).toHaveTextContent("S5 · Quick on the Draw");
    expect(s5).toHaveTextContent(
      "Increases the wearer's Effect Hit Rate by 40%"
    );

    const rankMaterials = within(detail).getByTestId(
      "light-cone-rank-materials"
    );
    await user.click(
      within(rankMaterials).getByText("Rank-up materials (1)", {
        selector: "summary",
      })
    );
    const rankMaterial = queryElement(rankMaterials, '[data-item-id="121000"]');
    expect(rankMaterial).toHaveTextContent("Lil' Twisty Bubble Gum");
    expect(rankMaterial).toHaveTextContent("121000");

    const progressionSummary = within(detail).getByText(
      "Progression (7 promotions)",
      { selector: "summary" }
    );
    await user.click(progressionSummary);
    const progression = closestElement(progressionSummary, "details");
    await user.click(
      within(progression).getByText("Promotion 0", { selector: "summary" })
    );
    const credit = queryElement(progression, '[data-item-id="2"]');
    expect(credit).toHaveTextContent("Credit");
    expect(credit).toHaveTextContent("×4000");

    const experienceSummary = within(detail).getByText(
      "Light Cone EXP and feed items (3)",
      { selector: "summary" }
    );
    await user.click(experienceSummary);
    const sparseAether = queryElement(
      closestElement(experienceSummary, "details"),
      '[data-item-id="221"]'
    );
    expect(sparseAether).toHaveTextContent("Sparse Aether");
    expect(sparseAether).toHaveTextContent("500 Light Cone EXP");
    expect(sparseAether).toHaveTextContent("250 Credit feed cost");

    await switchLocale(user, "中文");
    detail = screen.getByTestId("light-cone-detail");
    expect(detail).toHaveTextContent("眼疾手快");
    expect(detail).toHaveTextContent("效果命中提高20%");
    expect(detail).toHaveTextContent("稀薄以太");

    await user.clear(screen.getByRole("searchbox", { name: "搜索" }));
    await user.type(
      screen.getByRole("searchbox", { name: "搜索" }),
      "junior! Isn't that right, Trailblazer"
    );
    expect(await screen.findByText("显示 1 / 169 条记录")).toBeInTheDocument();
    await user.click(catalogItem(region, "light-cone", "21002"));
    detail = screen.getByTestId("light-cone-detail");
    expect(detail).toHaveTextContent("是不是，开拓者");
    expect(detail).not.toHaveTextContent("{NICKNAME}");
  }, 15_000);

  it("filters Relic kinds and exposes logical pieces, slots, affixes, and scoring tables", async () => {
    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveRelicSets);
    const region = await catalogRegion(
      "Relic and Planar set catalog results",
      60
    );

    await user.click(
      within(screen.getByRole("group", { name: "Set type" })).getByRole(
        "button",
        { name: "Planar Ornament" }
      )
    );
    expect(
      await screen.findByText(
        "Showing 28 of 60 sets · 184 logical pieces · 742 rarity variants"
      )
    ).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search" });
    await user.type(search, "太空封印站");
    expect(within(region).getAllByRole("button")).toHaveLength(1);
    expect(
      queryElement(
        catalogItem(region, "relic-set", "301"),
        '[data-item-icon-kind="relic-set"]'
      )
    ).toHaveAttribute("data-item-rarity", "5");
    let detail = closestElement(
      await screen.findByRole("heading", {
        level: 2,
        name: "Space Sealing Station",
      }),
      "aside"
    );
    expect(within(detail).getByText("Logical pieces (2)")).toBeInTheDocument();
    expect(within(detail).getByText("Planar Sphere")).toBeInTheDocument();
    expect(within(detail).getByText("Link Rope")).toBeInTheDocument();
    expect(
      detail.querySelectorAll('[data-item-icon-kind="relic-piece"]')
    ).toHaveLength(2);

    const advancedCatalogSummary = screen.getByText("Advanced catalog data", {
      selector: "summary",
    });
    const advancedCatalog = closestElement(advancedCatalogSummary, "details");
    expect(advancedCatalog).not.toHaveAttribute("open");
    await user.click(advancedCatalogSummary);

    const taxonomySummary = within(advancedCatalog).getByText(
      "Taxonomy · 9 Paths · 7 Combat Types · 6 slots"
    );
    await user.click(taxonomySummary);
    const taxonomy = closestElement(taxonomySummary, "details");
    expect(taxonomy).toHaveAttribute("open");
    expect(within(taxonomy).getByText("Memory")).toBeInTheDocument();
    expect(within(taxonomy).getByText("Remembrance")).toBeInTheDocument();

    const propertiesSummary =
      within(advancedCatalog).getByText("Properties (56)");
    await user.click(propertiesSummary);
    expect(closestElement(propertiesSummary, "details")).toHaveAttribute(
      "open"
    );

    const affixSummary = within(advancedCatalog).getByText(
      "Affix rolls · 117 main · 48 sub"
    );
    await user.click(affixSummary);
    const affixTables = within(
      closestElement(affixSummary, "details")
    ).getAllByRole("table");
    expect(affixTables).toHaveLength(2);
    expect(within(affixTables[0]!).getAllByRole("row")).toHaveLength(118);
    expect(within(affixTables[1]!).getAllByRole("row")).toHaveLength(49);

    const scoringSummary = within(advancedCatalog).getByText(
      "Scoring tables · 20 main bases · 12 sub bases · 97 Character rows"
    );
    await user.click(scoringSummary);
    const scoringTables = within(
      closestElement(scoringSummary, "details")
    ).getAllByRole("table");
    expect(scoringTables).toHaveLength(2);
    expect(within(scoringTables[0]!).getAllByRole("row")).toHaveLength(21);
    expect(within(scoringTables[1]!).getAllByRole("row")).toHaveLength(13);

    await switchLocale(user, "中文");
    detail = closestElement(
      screen.getByRole("heading", { level: 2, name: "太空封印站" }),
      "aside"
    );
    expect(within(detail).getByText("逻辑部位（2）")).toBeInTheDocument();
    expect(within(detail).getByText("位面球")).toBeInTheDocument();
    expect(within(detail).getByText("连结绳")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "Space Sealing Station");
    expect(
      await screen.findByText(
        "显示 1 / 60 套 · 184 件逻辑部位 · 742 个稀有度变体"
      )
    ).toBeInTheDocument();
  });

  it("keeps each catalog list first and opens selected details in a sheet at 390px", async () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query) =>
        ({
          matches: query === "(max-width: 1023px)",
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList
    );
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });

    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveCharacters);
    let region = await catalogRegion("Character catalog results", 93);
    let inlineDetail = await screen.findByTestId(
      "character-detail",
      undefined,
      asyncCatalogOptions
    );
    expect(
      region.compareDocumentPosition(inlineDetail) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    let selectedCard = catalogItem(region, "character", "1001");
    await user.click(selectedCard);
    let dialog = await screen.findByRole("dialog", { name: "March 7th" });
    expect(within(dialog).getByTestId("character-detail")).toHaveTextContent(
      "March 7th"
    );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(selectedCard).toHaveFocus();

    let tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(
      within(tabs).getByRole("link", { name: "Light Cone Archive" })
    );
    region = await catalogRegion("Light Cone catalog results", 169);
    inlineDetail = await screen.findByTestId(
      "light-cone-detail",
      undefined,
      asyncCatalogOptions
    );
    expect(
      region.compareDocumentPosition(inlineDetail) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    selectedCard = catalogItem(region, "light-cone", "20000");
    await user.click(selectedCard);
    dialog = await screen.findByRole("dialog", { name: "Arrows" });
    expect(within(dialog).getByTestId("light-cone-detail")).toHaveTextContent(
      "Arrows"
    );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(selectedCard).toHaveFocus();

    tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(within(tabs).getByRole("link", { name: "Relic Archive" }));
    region = await catalogRegion("Relic and Planar set catalog results", 60);
    inlineDetail = await screen.findByTestId(
      "relic-set-detail",
      undefined,
      asyncCatalogOptions
    );
    expect(
      region.compareDocumentPosition(inlineDetail) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    selectedCard = catalogItem(region, "relic-set", "301");
    await user.click(selectedCard);
    dialog = await screen.findByRole("dialog", {
      name: "Space Sealing Station",
    });
    expect(within(dialog).getByTestId("relic-set-detail")).toHaveTextContent(
      "Space Sealing Station"
    );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(selectedCard).toHaveFocus();
  }, 15_000);
});
