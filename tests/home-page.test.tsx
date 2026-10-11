import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { APP_PATHS, NAVIGATION_SECTIONS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import HomePage from "@/pages/HomePage";

describe("GGArtifact Star Rail home", () => {
  it("links every tool tab from the home index and all five page launchers", async () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </I18nProvider>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "GGArtifact" })
    ).toBeInTheDocument();
    const index = screen.getByRole("region", { name: "Find your next step" });
    expect(within(index).getAllByRole("link")).toHaveLength(18);
    expect(
      within(index)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(["Feedback", "Account Data", "Team DMG", "Builds", "Tier List", "Archive"]);
    expect(
      within(index).getByRole("link", { name: /Currency War lookup/ })
    ).toHaveAttribute("href", APP_PATHS.archiveCurrencyWar);
    expect(
      within(index).getByRole("link", { name: /Eidolon value/ })
    ).toHaveAttribute("href", APP_PATHS.teamInvestment);
    for (const section of NAVIGATION_SECTIONS) {
      for (const item of section.items) {
        expect(
          within(index)
            .getAllByRole("link")
            .some((link) => link.getAttribute("href") === item.path)
        ).toBe(true);
      }
    }
    const launchers = [
      [
        "Are my Characters ready for battle?",
        "Account Data",
        APP_PATHS.characters,
      ],
      ["Which team hits hardest?", "Team DMG", APP_PATHS.teamDamage],
      ["What should my Relics roll?", "Builds", APP_PATHS.builds],
      ["Who should I build next?", "Tier List", APP_PATHS.tierCharacters],
      ["What does this kit do?", "Archive", APP_PATHS.archiveCharacters],
    ] as const;
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .filter((heading) => heading.closest("a"))
        .map((heading) => heading.textContent)
    ).toEqual(launchers.map(([headline]) => headline));
    for (const [headline, section, path] of launchers) {
      const card = screen
        .getByRole("heading", { name: headline, level: 2 })
        .closest("a");
      expect(card).toHaveAttribute("href", path);
      expect(card).toHaveTextContent(section);
    }
    expect(
      screen.queryByRole("button", { name: /demo/i })
    ).not.toBeInTheDocument();
    // Let the asset lookup settle so unmounting does not leave a pending update.
    await screen.findByRole("heading", {
      name: "What does this kit do?",
      level: 2,
    });
  });
});
