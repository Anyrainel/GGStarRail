import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n/I18nContext";
import { DEFAULT_TEAM_STORE, emptyTeam } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

function renderPage() {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[APP_PATHS.teamDamage]}>
          <App />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

afterEach(() => {
  useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
});

describe("Team Damage page", () => {
  it("creates a team from the empty state", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "New team" }));
    expect(useTeamStore.getState().teams).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Add Character" })
    ).toHaveLength(4);
  });

  it("simulates a saved team and runs the investment tool", async () => {
    const user = userEvent.setup();
    const team = emptyTeam("team:ui-test");
    team.members[0] = { characterId: "1102", options: {}, skill: "kit" };
    team.members[1] = { characterId: "1309", options: {}, skill: "kit" };
    team.cycles = 2;
    useTeamStore.setState({ teams: [team], activeTeamId: team.id });
    renderPage();

    const perCycle = await screen.findByText(
      (_, element) =>
        element?.hasAttribute("data-damage-per-cycle") === true &&
        element.textContent !== "—",
      undefined,
      { timeout: 20_000 }
    );
    expect(Number(perCycle.textContent?.replace(/\D/g, ""))).toBeGreaterThan(0);

    const seele = screen.getByRole("article", { name: "Slot 1" });
    expect(within(seele).getAllByText("Recommended").length).toBeGreaterThan(0);
    expect(
      within(seele).getByRole("button", { name: "Ideal" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(seele).getByRole("group", { name: "Conditions" })
    ).toBeInTheDocument();

    const breakdown = screen.getByRole("region", { name: "By ability" });
    expect(within(breakdown).getAllByRole("row").length).toBeGreaterThan(1);

    await user.click(
      screen.getByRole("tab", { name: "Eidolons & Superimpositions" })
    );
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(
      () => expect(screen.getAllByText("Current").length).toBeGreaterThan(0),
      { timeout: 60_000 }
    );
  }, 90_000);
});
