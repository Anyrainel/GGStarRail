import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NAVIGATION_SECTIONS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import HomePage from "@/pages/HomePage";

describe("GGArtifact Star Rail home", () => {
  it("links every tool tab from the home index and all four page launchers", async () => {
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
    expect(within(index).getAllByRole("link")).toHaveLength(13);
    for (const section of NAVIGATION_SECTIONS) {
      for (const item of section.items) {
        expect(
          within(index)
            .getAllByRole("link")
            .some((link) => link.getAttribute("href") === item.path)
        ).toBe(true);
      }
    }
    for (const title of [
      "Review your account",
      "Plan Relic builds",
      "Set your priorities",
      "Explore game data",
    ]) {
      expect(
        screen.getByRole("heading", { name: title }).closest("a")
      ).toHaveAttribute("href");
    }
    expect(
      screen.queryByRole("button", { name: /demo/i })
    ).not.toBeInTheDocument();
    // Let the asset lookup settle so unmounting does not leave a pending update.
    await screen.findByRole("heading", { name: "Explore game data" });
  });
});
