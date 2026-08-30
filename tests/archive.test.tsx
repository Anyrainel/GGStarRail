import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";
import { APP_PATHS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";

const asyncCatalogOptions = { timeout: 15_000 };

function renderArchive(path: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </I18nProvider>
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

function localeButton(name: "EN" | "中文") {
  const button = screen.getAllByRole("button", { name })[0];
  if (!button) throw new Error(`Locale button ${name} was not rendered`);
  return button;
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

describe("Archive catalogs", () => {
  it("loads each complete catalog through the route-local async boundary", async () => {
    const user = userEvent.setup();
    renderArchive(APP_PATHS.archiveCharacters);

    expect(
      screen.getByText("Loading the local reference catalog…")
    ).toBeInTheDocument();
    await catalogRegion("Character catalog results", 93);
    expect(screen.getByText("Showing 93 of 93 records")).toBeInTheDocument();
    expect(
      screen.getByText(
        "93 Characters · 169 Light Cones · 60 sets · 184 logical pieces across 742 rarity variants"
      )
    ).toBeInTheDocument();

    let tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(
      within(tabs).getByRole("link", { name: "Light Cone Archive" })
    );
    await catalogRegion("Light Cone catalog results", 169);
    expect(screen.getByText("Showing 169 of 169 records")).toBeInTheDocument();

    tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(
      within(tabs).getByRole("link", { name: "Relic Set Archive" })
    );
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
    const trailblazer = within(region).getByRole("button", { name: /8001/ });
    expect(trailblazer).toHaveTextContent("Trailblazer · 8001");
    expect(trailblazer).not.toHaveTextContent("{NICKNAME}");
    await user.click(trailblazer);
    let detail = screen.getByTestId("character-detail");
    expect(detail).toHaveTextContent("A girl/boy who boarded");
    expect(detail).not.toHaveTextContent("{F#");
    expect(detail).not.toHaveTextContent("{M#");

    await user.clear(search);
    await user.type(search, "开拓者");
    expect(
      await screen.findByText("Showing 12 of 93 records")
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: /8010/ })
    ).toHaveTextContent("Trailblazer · 8010");

    await user.clear(search);
    await user.type(search, "三月七");
    expect(
      await screen.findByText("Showing 2 of 93 records")
    ).toBeInTheDocument();
    expect(within(region).getAllByRole("button")).toHaveLength(2);

    const huntMarch = within(region).getByRole("button", { name: /1224/ });
    expect(huntMarch).toHaveTextContent("The Hunt");
    expect(huntMarch).toHaveTextContent("Imaginary");
    expect(huntMarch).not.toHaveTextContent("Rogue");
    await user.click(huntMarch);
    expect(huntMarch).toHaveAttribute("aria-pressed", "true");
    detail = closestElement(
      screen.getByRole("heading", { level: 2, name: "March 7th" }),
      "aside"
    );
    expect(within(detail).getByText("1224")).toBeInTheDocument();
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
    expect(
      within(region).getByRole("button", { name: /1001/ })
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(localeButton("中文"));
    expect(
      screen.getByRole("heading", { level: 1, name: "角色图鉴" })
    ).toBeInTheDocument();
    detail = closestElement(
      screen.getByRole("heading", { level: 2, name: "三月七" }),
      "aside"
    );
    expect(within(detail).getByText("1001")).toBeInTheDocument();
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
    expect(
      within(region).getByRole("button", { name: /8010/ })
    ).toHaveTextContent("开拓者 · 8010");
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
    expect(
      within(region).getByRole("button", { name: /20000/ })
    ).toHaveTextContent("Arrows");
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
      within(detail).getByRole("heading", { level: 3, name: "Crisis" })
    ).toBeInTheDocument();
    expect(within(detail).getByText("Up to S5")).toBeInTheDocument();
    expect(within(detail).getByText("S1")).toBeInTheDocument();
    expect(within(detail).getByText("S5")).toBeInTheDocument();

    await user.click(localeButton("中文"));
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
    expect(
      screen.getByText(
        "1.1 detail model · 611 base skills · 558 Eidolons · 1699 Trace nodes · 7 Servants · 10 seasonal variants · 845 Superimposition rows · 238 progression items"
      )
    ).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Search" });

    await user.type(search, "March 7th");
    await user.click(within(region).getByRole("button", { name: /1001/ }));
    let detail = screen.getByTestId("character-detail");

    const baseSkills = within(detail).getByTestId("character-base-skills");
    expect(baseSkills).not.toHaveAttribute("open");
    await user.click(
      within(baseSkills).getByText("Base skills · 6 skills · 57 level rows", {
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
      "014e33e2404f8cd668bf06fc2ea6db53b6bc3992"
    );
    expect(eidolonItem).toHaveTextContent("TextMap/TextMapEN.json");

    const traces = within(detail).getByTestId("character-traces");
    expect(traces).not.toHaveAttribute("open");
    await user.click(
      within(traces).getByText("Trace tree · 18 nodes · 50 level rows", {
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

    await user.click(localeButton("中文"));
    detail = screen.getByTestId("character-detail");
    expect(detail).toHaveTextContent("记忆中的你");
    expect(detail).toHaveTextContent("【三月七•存护】的星魂");
    await user.click(localeButton("EN"));
    detail = screen.getByTestId("character-detail");

    await user.clear(search);
    await user.type(search, "Garmentmaker");
    expect(
      await screen.findByText("Showing 2 of 93 records")
    ).toBeInTheDocument();
    await user.click(within(region).getByRole("button", { name: /1402/ }));
    detail = screen.getByTestId("character-detail");
    expect(
      within(detail).getByTestId("character-base-skills")
    ).toHaveTextContent("Base skills · 7 skills · 67 level rows");
    const servants = within(detail).getByTestId("character-servants");
    await user.click(
      within(servants).getByText("Servants · 1 records · 4 skills", {
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
    await user.click(within(region).getByRole("button", { name: /1004/ }));
    detail = screen.getByTestId("character-detail");
    expect(
      within(detail).getByTestId("character-base-skills")
    ).toHaveTextContent("Base skills · 6 skills · 57 level rows");
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
    await user.click(within(region).getByRole("button", { name: /1005/ }));
    detail = screen.getByTestId("character-detail");
    expect(detail).toHaveTextContent("set up Trailblazer to absorb");
    expect(detail).not.toHaveTextContent("{NICKNAME}");
    await user.click(localeButton("中文"));
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
      expect(
        within(region).getByRole("button", { name: /22000/ })
      ).toBeInTheDocument();
    });
    await user.click(within(region).getByRole("button", { name: /22000/ }));
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
      within(rankMaterials).getByText("Exact rank-up material IDs (1)", {
        selector: "summary",
      })
    );
    const rankMaterial = queryElement(rankMaterials, '[data-item-id="121000"]');
    expect(rankMaterial).toHaveTextContent("Lil' Twisty Bubble Gum");
    expect(rankMaterial).toHaveTextContent("121000");

    const progressionSummary = within(detail).getByText(
      "Progression · 7 promotions · 17 material rows",
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

    await user.click(localeButton("中文"));
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
    await user.click(within(region).getByRole("button", { name: /21002/ }));
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

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Set type" }),
      "planar_ornament"
    );
    expect(
      await screen.findByText(
        "Showing 28 of 60 sets · 184 logical pieces · 742 rarity variants"
      )
    ).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search" });
    await user.type(search, "太空封印站");
    expect(within(region).getAllByRole("button")).toHaveLength(1);
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

    const taxonomySummary = screen.getByText(
      "Taxonomy · 9 Paths · 7 Combat Types · 6 slots"
    );
    await user.click(taxonomySummary);
    const taxonomy = closestElement(taxonomySummary, "details");
    expect(taxonomy).toHaveAttribute("open");
    expect(within(taxonomy).getByText("Memory")).toBeInTheDocument();
    expect(within(taxonomy).getByText("Remembrance")).toBeInTheDocument();

    const propertiesSummary = screen.getByText("Properties (56)");
    await user.click(propertiesSummary);
    expect(closestElement(propertiesSummary, "details")).toHaveAttribute(
      "open"
    );

    const affixSummary = screen.getByText("Affix rolls · 117 main · 48 sub");
    await user.click(affixSummary);
    const affixTables = within(
      closestElement(affixSummary, "details")
    ).getAllByRole("table");
    expect(affixTables).toHaveLength(2);
    expect(within(affixTables[0]!).getAllByRole("row")).toHaveLength(118);
    expect(within(affixTables[1]!).getAllByRole("row")).toHaveLength(49);

    const scoringSummary = screen.getByText(
      "Scoring tables · 20 main bases · 12 sub bases · 97 Character rows"
    );
    await user.click(scoringSummary);
    const scoringTables = within(
      closestElement(scoringSummary, "details")
    ).getAllByRole("table");
    expect(scoringTables).toHaveLength(2);
    expect(within(scoringTables[0]!).getAllByRole("row")).toHaveLength(21);
    expect(within(scoringTables[1]!).getAllByRole("row")).toHaveLength(13);

    await user.click(localeButton("中文"));
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

  it("moves and focuses every selected detail before its grid at 390px", async () => {
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
    await user.click(within(region).getByRole("button", { name: /1001/ }));
    let detail = screen.getByTestId("character-detail");
    await waitFor(() => expect(detail).toHaveFocus());
    expect(detail).toHaveClass("order-1", "lg:order-2");
    expect(region).toHaveClass("order-2", "lg:order-1");

    let tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(
      within(tabs).getByRole("link", { name: "Light Cone Archive" })
    );
    region = await catalogRegion("Light Cone catalog results", 169);
    await user.click(within(region).getByRole("button", { name: /20000/ }));
    detail = screen.getByTestId("light-cone-detail");
    await waitFor(() => expect(detail).toHaveFocus());
    expect(detail).toHaveClass("order-1", "lg:order-2");
    expect(region).toHaveClass("order-2", "lg:order-1");

    tabs = screen.getByRole("navigation", { name: "Archive catalogs" });
    await user.click(
      within(tabs).getByRole("link", { name: "Relic Set Archive" })
    );
    region = await catalogRegion("Relic and Planar set catalog results", 60);
    await user.click(within(region).getByRole("button", { name: /301/ }));
    detail = screen.getByTestId("relic-set-detail");
    await waitFor(() => expect(detail).toHaveFocus());
    expect(detail).toHaveClass("order-1", "lg:order-2");
    expect(region).toHaveClass("order-2", "lg:order-1");
  });
});
