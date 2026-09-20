import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LightConeDetail } from "@/components/archive/LightConeDetail";
import { STORAGE_KEYS } from "@/config/identity";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { setBetaEnabled } from "@/data/betaState";
import { I18nProvider } from "@/i18n/I18nContext";
import { LightConeCatalog } from "@/pages/archive/LightConeCatalog";
import { RelicSetCatalog } from "@/pages/archive/RelicSetCatalog";
import {
  loadLightCones,
  loadPropertyTables,
} from "@/providers/reference/catalog";

function renderCatalog(children: ReactNode) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

const catalogWait = { timeout: 15_000 };

describe("Light Cone archive cards", () => {
  beforeEach(() => setBetaEnabled(false));

  it("orders each Path by newest release patch before rarity", async () => {
    renderCatalog(<LightConeCatalog />);
    const region = await screen.findByRole(
      "region",
      { name: "Light Cone catalog results" },
      catalogWait
    );
    const catalog = await loadLightCones();
    const byPath = new Map<string, string[]>();
    for (const card of region.querySelectorAll("[data-light-cone-id]")) {
      const cone = catalog.byId.get(card.getAttribute("data-light-cone-id")!)!;
      const versions = byPath.get(cone.path_id) ?? [];
      if (cone.release_version) versions.push(cone.release_version);
      byPath.set(cone.path_id, versions);
    }
    expect(byPath.size).toBeGreaterThan(6);
    for (const versions of byPath.values()) {
      expect(versions).toEqual(
        [...versions].sort((left, right) =>
          right.localeCompare(left, "en", { numeric: true })
        )
      );
    }
  });

  it("preserves authored effect changes at an individual Superimposition", async () => {
    const [catalog, properties] = await Promise.all([
      loadLightCones(),
      loadPropertyTables(),
    ]);
    const original = catalog.byId.get("20000")!;
    const lightCone = {
      ...original,
      effect: {
        ...original.effect,
        superimpositions: original.effect.superimpositions.map((level) =>
          level.level === 5
            ? {
                ...level,
                description: {
                  en: { value: "After attacking, restores #1[i] Energy." },
                  "zh-CN": { value: "攻击后恢复#1[i]点能量。" },
                },
                parameters: [4],
              }
            : level
        ),
      },
    };
    renderCatalog(
      <LightConeDetail
        lightCone={lightCone}
        path={properties.pathById.get(lightCone.path_id)!}
      />
    );
    expect(
      screen.getByText(/CRIT Rate increases by 12\/15\/18\/21%/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("After attacking, restores 4 Energy.")
    ).toBeInTheDocument();
    expect(screen.getByText("Superimposition 5")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Superimposition/ })
    ).not.toBeInTheDocument();
  });

  it("groups cards by Path and displays all Superimposition values inline", async () => {
    const user = userEvent.setup();
    renderCatalog(<LightConeCatalog />);
    const card = await screen.findByRole(
      "button",
      { name: "Arrows" },
      catalogWait
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^The Hunt\s*\(/ })
    ).toBeInTheDocument();
    await user.click(card);
    const dialog = await screen.findByRole("dialog", { name: "Arrows" });
    expect(within(dialog).getByText("Level 80")).toBeInTheDocument();
    for (const stat of ["HP", "ATK", "DEF", "846", "317", "264"])
      expect(
        within(dialog).getByText(stat, { exact: true })
      ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/CRIT Rate increases by 12\/15\/18\/21\/24%/)
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /Superimposition/ })
    ).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(
      /Ability20000|Source details|EXP items|Promotion|TextMap|20000/
    );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card).toHaveFocus();
  });

  it("searches both languages across inactive chips and restores chip filters when cleared", async () => {
    const user = userEvent.setup();
    renderCatalog(<LightConeCatalog />);
    await screen.findByRole("button", { name: "Arrows" }, catalogWait);
    const rarity = screen.getByRole("button", { name: "★5" });
    await user.click(rarity);
    expect(
      screen.queryByRole("button", { name: "Arrows" })
    ).not.toBeInTheDocument();
    const search = screen.getByRole("searchbox");
    await user.type(search, "锋镝");
    expect(screen.getByRole("button", { name: "Arrows" })).toBeInTheDocument();
    expect(rarity).toBeDisabled();
    await user.clear(search);
    expect(rarity).not.toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Arrows" })
    ).not.toBeInTheDocument();
  });

  it("uses the same accessible dialog with localized effects on narrow screens", async () => {
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    renderCatalog(<LightConeCatalog />);
    await user.click(
      await screen.findByRole("button", { name: "锋镝" }, catalogWait)
    );
    const dialog = await screen.findByRole("dialog", { name: "锋镝" });
    expect(
      within(dialog).getByText(/暴击率提高12\/15\/18\/21\/24%/)
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /叠影/ })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "关闭" })
    ).toBeInTheDocument();
  });
});

describe("Relic archive cards", () => {
  beforeEach(() => setBetaEnabled(false));

  it("shows set and piece artwork together with visible two- and four-piece effects", async () => {
    const user = userEvent.setup();
    renderCatalog(<RelicSetCatalog />);
    const card = await screen.findByRole(
      "article",
      { name: "Passerby of Wandering Cloud" },
      catalogWait
    );
    expect(card.querySelectorAll("img")).toHaveLength(5);
    expect(within(card).getByText("2-Piece")).toBeInTheDocument();
    expect(within(card).getByText("4-Piece")).toBeInTheDocument();
    expect(card).toHaveTextContent(/Outgoing Healing.*10%/);
    expect(
      screen.queryByText(/Logical pieces|Set bonuses|rarity variants/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Space Sealing Station" })
    ).toBeVisible();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Planar/ }));
    expect(
      screen.queryByRole("article", { name: "Passerby of Wandering Cloud" })
    ).not.toBeInTheDocument();
    const planar = screen.getByRole("article", {
      name: "Space Sealing Station",
    });
    expect(planar.querySelectorAll("img")).toHaveLength(3);
    expect(within(planar).getByText("2-Piece")).toBeInTheDocument();
    expect(within(planar).queryByText("4-Piece")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Planar/ }));
    await user.click(screen.getByRole("button", { name: /^Cavern/ }));
    await user.type(screen.getByRole("searchbox"), "太空封印站");
    expect(screen.getByRole("button", { name: /^Cavern/ })).toBeDisabled();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("article", { name: "Space Sealing Station" })
    ).toBeInTheDocument();
  });

  it("orders both set kinds by newest source release patch", async () => {
    renderCatalog(<RelicSetCatalog />);
    await screen.findByRole(
      "article",
      { name: "Passerby of Wandering Cloud" },
      catalogWait
    );
    const cards = screen.getAllByRole("article");
    const { loadRelicSets } = await import("@/providers/reference/catalog");
    const sets = (await loadRelicSets()).values;
    expect(cards).toHaveLength(sets.length);
    const displayed = cards.map(
      (card) =>
        sets.find((set) => set.id === card.getAttribute("data-relic-set-id"))!
    );
    expect(new Set(displayed.map((set) => set.kind)).size).toBe(2);
    for (let index = 1; index < displayed.length; index += 1) {
      expect(
        displayed[index - 1]!.release_version.localeCompare(
          displayed[index]!.release_version,
          "en",
          { numeric: true }
        )
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("localizes concise set labels and retains English-name search", async () => {
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    const user = userEvent.setup();
    renderCatalog(<RelicSetCatalog />);
    await screen.findByRole(
      "region",
      { name: "遗器与位面饰品套装图鉴结果" },
      catalogWait
    );
    await user.type(
      screen.getByRole("searchbox"),
      "Passerby of Wandering Cloud"
    );
    const card = screen.getByRole("article", { name: "云无留迹的过客" });
    expect(within(card).getByText("2件套")).toBeInTheDocument();
    expect(within(card).getByText("4件套")).toBeInTheDocument();
    expect(card).toHaveTextContent("治疗量提高10%");
    expect(card).not.toHaveTextContent(/★|套装效果|逻辑部件/);
  });
});
