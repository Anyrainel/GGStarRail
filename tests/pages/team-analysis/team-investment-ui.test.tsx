import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/app/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { emptyTeam, type TeamPlan } from "@/domain/team/schemas";
import { I18nProvider } from "@/i18n/I18nContext";
import { clearResultCache } from "@/services/combat/resultCache";
import { DEFAULT_TEAM_STORE } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

function renderInvestment(teamId: string) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter
          initialEntries={[
            `${APP_PATHS.teamInvestment}?team=${encodeURIComponent(teamId)}`,
          ]}
        >
          <App />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

function seedTeam(id: string, characterIds: readonly string[]): TeamPlan {
  const team = emptyTeam(id);
  team.cycles = 1;
  characterIds.forEach((characterId, slot) => {
    team.members[slot] = { characterId, options: {}, skill: "kit" };
  });
  useTeamStore.setState({ teams: [team], activeTeamId: team.id });
  return team;
}

async function roster() {
  return screen.findByRole(
    "region",
    { name: "Team Roster" },
    { timeout: 15_000 }
  );
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  field: string,
  option: string
) {
  await user.click(within(scope).getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

afterEach(() => {
  useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
  clearResultCache();
});

describe("Team DMG Investment", () => {
  it("keeps starting ranks shared and persists bounded investment ceilings", async () => {
    const user = userEvent.setup();
    seedTeam("team:investment-start", ["1102", "1309"]);
    renderInvestment("team:investment-start");
    const shared = await roster();
    const seele = within(shared).getByRole("article", { name: "Seele" });
    await choose(user, seele, "Eidolon", "E2");
    const panel = screen.getByRole("region", { name: "Investment" });
    expect(within(panel).queryByRole("article")).toBeNull();
    expect(
      within(panel).queryByRole("combobox", { name: "From Eidolon" })
    ).toBeNull();
    await user.click(
      within(panel).getAllByRole("combobox", { name: "To Eidolon" })[0]!
    );
    expect(await screen.findByRole("option", { name: "E1" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await user.click(await screen.findByRole("option", { name: "E4" }));
    expect(
      useTeamStore.getState().analysisByTeamId["team:investment-start"]
        ?.investment?.limits["0:1102"]?.eidolon
    ).toBe(4);
    expect(useTeamStore.getState().teams[0]?.members[0]?.eidolon).toBe(2);
    expect(within(panel).queryByText("No results yet")).toBeNull();
    expect(
      within(panel).getByRole("button", { name: "Run Analysis" })
    ).toBeEnabled();
  });

  it("runs within the limits and shows the table and the combined order", async () => {
    const user = userEvent.setup();
    seedTeam("team:investment-run", ["1102"]);
    renderInvestment("team:investment-run");
    await roster();
    const seele = screen.getByRole("region", { name: "Investment" });
    await choose(user, seele, "To Eidolon", "E1");
    const fromSuperimposition = "S1";
    await choose(user, seele, "To Superimposition", fromSuperimposition);

    const chart = screen.getByRole("region", { name: "Investment" });
    // Seele has no account Relics, so the ideal-Relic budget applies.
    expect(
      within(chart).getByRole("combobox", { name: "Substats" })
    ).toHaveTextContent("Realistic");
    await user.click(
      within(chart).getByRole("button", { name: "Run Analysis" })
    );

    const table = await within(chart).findByRole(
      "table",
      {},
      { timeout: 90_000 }
    );
    const rows = within(table).getAllByRole("row");
    // Header, the start state, then exactly one copy: E0 → E1 within the limits.
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent(`0E0${fromSuperimposition}100.0%`);
    expect(rows[1]).toHaveTextContent("Current");
    expect(rows[2]).toHaveTextContent(`1E1${fromSuperimposition}`);
    expect(rows[2]).toHaveTextContent("E0→E1");
    expect(
      within(chart).getByRole("img", { name: "Team DMG by copies" })
    ).toBeInTheDocument();
    expect(
      within(within(chart).getByRole("list", { name: "Characters" })).getByText(
        "Seele"
      )
    ).toBeInTheDocument();
    expect(within(chart).queryByText("No results yet")).toBeNull();

    await user.click(within(chart).getByRole("radio", { name: "Order" }));
    expect(within(chart).getByRole("radio", { name: "Order" })).toBeChecked();
    const order = within(chart).getByRole("region", { name: "Combined order" });
    const steps = within(order).getAllByRole("listitem");
    expect(steps).toHaveLength(1);
    expect(steps[0]).toHaveTextContent("Seele");
    expect(steps[0]).toHaveTextContent("E1");
    expect(within(chart).queryByRole("table")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Rotation" }));
    await user.click(screen.getByRole("radio", { name: "Investment" }));
    expect(
      within(chart).getByRole("region", { name: "Combined order" })
    ).toHaveTextContent("Seele");
    await user.click(screen.getByRole("button", { name: "Back to teams" }));
    const grid = await screen.findByRole("region", { name: "Teams" });
    await user.click(within(grid).getByRole("button", { name: "Analysis" }));
    expect(
      screen.getByRole("region", { name: "Combined order" })
    ).toHaveTextContent("Seele");
  }, 120_000);
});
