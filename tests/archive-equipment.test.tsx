import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { setBetaEnabled } from "@/data/betaState";
import { I18nProvider } from "@/i18n/I18nContext";
import { LightConeCatalog } from "@/pages/archive/LightConeCatalog";
import { RelicSetCatalog } from "@/pages/archive/RelicSetCatalog";

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

  it("groups cards by Path and opens focused details with selectable Superimposition", async () => {
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
      within(dialog).getByText(/CRIT Rate increases by 12%/)
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Superimposition 5" })
    );
    expect(
      within(dialog).getByText(/CRIT Rate increases by 24%/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Superimposition 5" })
    ).toHaveAttribute("aria-pressed", "true");
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
    expect(within(dialog).getByText(/暴击率提高12%/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /叠影.*5/ }));
    expect(within(dialog).getByText(/暴击率提高24%/)).toBeInTheDocument();
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
    await user.click(screen.getByRole("tab", { name: /^Planar/ }));
    const planar = screen.getByRole("article", {
      name: "Space Sealing Station",
    });
    expect(planar.querySelectorAll("img")).toHaveLength(3);
    expect(within(planar).getByText("2-Piece")).toBeInTheDocument();
    expect(within(planar).queryByText("4-Piece")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "太空封印站");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("article", { name: "Space Sealing Station" })
    ).toBeInTheDocument();
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
