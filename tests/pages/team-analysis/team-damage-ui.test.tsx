import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/app/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { emptyTeam, type TeamPlan } from "@/domain/team/schemas";
import { I18nProvider } from "@/i18n/I18nContext";
import { DEFAULT_TEAM_STORE } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "../../fixtures/demoAccount";

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  );
}

/** The browser's Forward button. */
function ForwardProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(1)}>
      History forward
    </button>
  );
}

function renderPage(path: string = APP_PATHS.teamDamage) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <LocationProbe />
          <ForwardProbe />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

function seedTeam(id: string, characterIds: readonly string[]): TeamPlan {
  const team = emptyTeam(id);
  characterIds.forEach((characterId, slot) => {
    team.members[slot] = { characterId, options: {}, skill: "kit" };
  });
  return team;
}

function seed(...teams: TeamPlan[]) {
  useTeamStore.setState({ teams, activeTeamId: teams[0]?.id ?? null });
}

const teamIds = () => useTeamStore.getState().teams.map((team) => team.id);

async function grid() {
  return screen.findByRole("region", { name: "Teams" }, { timeout: 15_000 });
}

afterEach(() => {
  useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

async function seedAccount() {
  const account = await createDemoAccount(new Date("2026-09-02T00:00:00Z"));
  act(() => useWorkspaceStore.getState().replaceAccount(account));
}

/**
 * Owned only, switched on, with no search text (grid filters live for the
 * whole session, so earlier tests may have left some).
 */
async function ownedOnlyOn(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByRole("searchbox", { name: "Search teams" }));
  const chip = screen.getByRole("button", { name: "Owned only" });
  if (chip.getAttribute("aria-pressed") !== "true") await user.click(chip);
  expect(chip).toHaveAttribute("aria-pressed", "true");
  return chip;
}

describe("Team DMG empty state", () => {
  it("shows a ghost card whose first pick creates the team", async () => {
    const user = userEvent.setup();
    renderPage();
    const main = screen.getByRole("main");
    expect(
      await within(main).findByRole(
        "heading",
        { level: 2, name: "Team DMG" },
        { timeout: 15_000 }
      )
    ).toBeInTheDocument();
    expect(within(main).queryByRole("searchbox")).toBeNull();
    expect(useTeamStore.getState().teams).toHaveLength(0);

    const ghost = within(main).getByRole("article", { name: "Team 1" });
    const slots = within(ghost).getAllByRole("button", {
      name: "Add Character",
    });
    expect(slots).toHaveLength(4);
    expect(
      within(ghost).getByRole("button", { name: "Analysis" })
    ).toBeDisabled();
    await user.click(slots[2] as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "Seele" }));

    const [team] = useTeamStore.getState().teams;
    expect(team?.members.map((member) => member?.characterId ?? null)).toEqual([
      "1102",
      null,
      null,
      null,
    ]);
    expect(await grid()).toBeInTheDocument();
  }, 30_000);

  it("creates a team from the call to action and shows the grid", async () => {
    const user = userEvent.setup();
    renderPage(APP_PATHS.teamChoice);
    const main = screen.getByRole("main");
    await user.click(
      await within(main).findByRole(
        "button",
        { name: "New team" },
        { timeout: 15_000 }
      )
    );
    expect(useTeamStore.getState().teams).toHaveLength(1);
    const cards = within(await grid()).getAllByRole("article");
    expect(cards).toHaveLength(1);
    expect(
      within(cards[0] as HTMLElement).getByRole("button", {
        name: "Analysis",
      })
    ).toBeDisabled();
    expect(
      within(main).getByRole("searchbox", { name: "Search teams" })
    ).toBeInTheDocument();
  }, 30_000);
});

describe("Team DMG grid", () => {
  it("adds teams at either end without stacking empty teams", async () => {
    const user = userEvent.setup();
    seed(seedTeam("team:a", ["1102"]), seedTeam("team:b", ["1309"]));
    renderPage();
    await grid();
    await user.click(
      screen.getByRole("button", { name: "New team at the top" })
    );
    const [top] = teamIds();
    expect(teamIds()).toEqual([top, "team:a", "team:b"]);
    await user.click(
      screen.getByRole("button", { name: "New team at the top" })
    );
    expect(teamIds()).toHaveLength(3);
    await user.click(
      screen.getByRole("button", { name: "New team at the bottom" })
    );
    expect(teamIds()).toHaveLength(4);
    expect(teamIds().slice(1, 3)).toEqual(["team:a", "team:b"]);
  });

  it("renames, moves, duplicates and deletes from a card", async () => {
    const user = userEvent.setup();
    seed(seedTeam("team:a", ["1102"]), seedTeam("team:b", ["1309"]));
    renderPage();
    const teams = await grid();

    const first = within(teams).getByRole("article", { name: "Team 1" });
    const name = within(first).getByRole("textbox", { name: "Team name" });
    await user.type(name, "Hypercarry{Enter}");
    expect(useTeamStore.getState().teams[0]?.name).toBe("Hypercarry");

    const renamed = within(teams).getByRole("article", { name: "Hypercarry" });
    await user.click(
      within(renamed).getByRole("button", { name: "Team actions" })
    );
    expect(screen.getByRole("menuitem", { name: "Move up" })).toHaveAttribute(
      "data-disabled"
    );
    await user.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(teamIds()).toEqual(["team:b", "team:a"]);

    await user.click(
      within(
        within(teams).getByRole("article", { name: "Hypercarry" })
      ).getByRole("button", { name: "Team actions" })
    );
    // A URL-selection subscriber can run synchronously during duplication.
    const unsubscribe = useTeamStore.subscribe((state, previous) => {
      if (state.teams.length > previous.teams.length) {
        useTeamStore.getState().setActiveTeam("team:a");
      }
    });
    try {
      await user.click(
        screen.getByRole("menuitem", { name: "Duplicate team" })
      );
    } finally {
      unsubscribe();
    }
    expect(teamIds()).toHaveLength(3);

    await user.click(
      within(within(teams).getByRole("article", { name: "Team 1" })).getByRole(
        "button",
        { name: "Team actions" }
      )
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete team" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete team",
      })
    );
    expect(teamIds()).not.toContain("team:b");
    expect(teamIds()).toHaveLength(2);
  });

  it("filters cards by search text and keeps them in the DOM", async () => {
    const user = userEvent.setup();
    seed(seedTeam("team:a", ["1102"]), seedTeam("team:b", ["1309"]));
    renderPage();
    const teams = await grid();
    await user.type(
      screen.getByRole("searchbox", { name: "Search teams" }),
      "Robin"
    );
    const cards = within(teams).getAllByRole("article", { hidden: true });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("hidden");
    expect(cards[1]).not.toHaveAttribute("hidden");
  });
});

describe("Team DMG Owned only", () => {
  it("turns off when a pick adds an unowned Character to a team", async () => {
    const user = userEvent.setup();
    await seedAccount();
    // Dan Heng is owned; Seele is not.
    seed(seedTeam("team:owned", ["1002"]), seedTeam("team:mixed", ["1102"]));
    renderPage();
    const teams = await grid();
    const chip = await ownedOnlyOn(user);
    const cards = within(teams).getAllByRole("article", { hidden: true });
    expect(cards[0]).not.toHaveAttribute("hidden");
    expect(cards[1]).toHaveAttribute("hidden");

    await user.click(
      within(cards[0] as HTMLElement).getAllByRole("button", {
        name: "Add Character",
      })[0] as HTMLElement
    );
    await user.click(await screen.findByRole("button", { name: "Seele" }));
    expect(
      useTeamStore.getState().teams[0]?.members.map((m) => m?.characterId)
    ).toEqual(["1002", "1102", undefined, undefined]);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(cards[0]).not.toHaveAttribute("hidden");
    expect(cards[1]).not.toHaveAttribute("hidden");
  });

  it("offers a reset when the filters hide every team", async () => {
    const user = userEvent.setup();
    await seedAccount();
    seed(seedTeam("team:unowned", ["1102"]));
    renderPage();
    const teams = await grid();
    const chip = await ownedOnlyOn(user);
    expect(
      within(teams).getByRole("article", { hidden: true })
    ).toHaveAttribute("hidden");
    expect(
      screen.getByText("No teams match these filters.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(within(teams).getByRole("article")).not.toHaveAttribute("hidden");
    expect(screen.queryByText("No teams match these filters.")).toBeNull();
  });
});

describe("Team DMG detail", () => {
  it("keeps mode settings when switching modes, teams and the grid", async () => {
    const user = userEvent.setup();
    await seedAccount();
    seed(seedTeam("team:a", ["1102"]), seedTeam("team:b", ["1309"]));
    renderPage();
    const open = async (name: string) =>
      user.click(
        within(within(await grid()).getByRole("article", { name })).getByRole(
          "button",
          { name: "Analysis" }
        )
      );
    await open("Team 1");
    await user.click(await screen.findByRole("radio", { name: "Investment" }));
    const limit = await screen.findByRole("combobox", { name: "To Eidolon" });
    await user.click(limit);
    await user.click(await screen.findByRole("option", { name: "E2" }));
    await user.click(screen.getByRole("radio", { name: "Builds" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Owned Light Cones only" })
    );
    await user.click(screen.getByRole("radio", { name: "Investment" }));
    expect(
      screen.getByRole("combobox", { name: "To Eidolon" })
    ).toHaveTextContent("E2");
    await user.click(screen.getByRole("radio", { name: "Builds" }));
    expect(
      screen.getByRole("checkbox", { name: "Owned Light Cones only" })
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Back to teams" }));
    await open("Team 2");
    expect(screen.getByRole("radio", { name: "Relics" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Back to teams" }));
    await open("Team 1");
    expect(screen.getByRole("radio", { name: "Builds" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Owned Light Cones only" })
    ).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Investment" }));
    expect(
      screen.getByRole("combobox", { name: "To Eidolon" })
    ).toHaveTextContent("E2");
    expect(screen.getAllByRole("region", { name: "Team Roster" })).toHaveLength(
      1
    );
    expect(
      useTeamStore.getState().analysisByTeamId["team:a"]?.investment?.limits[
        "0:1102"
      ]?.eidolon
    ).toBe(2);
  });

  it("goes back through history to the grid that opened the team", async () => {
    const user = userEvent.setup();
    seed(seedTeam("team:a", ["1102"]));
    renderPage();
    const card = within(await grid()).getByRole("article", { name: "Team 1" });
    await user.click(within(card).getByRole("button", { name: "Analysis" }));
    await screen.findByRole("heading", { level: 2, name: "Team 1" });
    await user.click(screen.getByRole("radio", { name: "Investment" }));
    await user.click(screen.getByRole("button", { name: "Back to teams" }));
    expect(await grid()).toBeInTheDocument();
    // The detail is still the next history entry, not a replaced duplicate.
    await user.click(screen.getByRole("button", { name: "History forward" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Team 1" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("team%3Aa");
    expect(screen.getByRole("radio", { name: "Investment" })).toBeChecked();
  });

  it("lists every Light Cone, the Character's Path first", async () => {
    const user = userEvent.setup();
    seed(seedTeam("team:lc", ["1102"]));
    renderPage(`${APP_PATHS.teamDamage}?team=team%3Alc`);
    const roster = await screen.findByRole(
      "region",
      { name: "Team Roster" },
      { timeout: 15_000 }
    );
    const seele = within(roster).getByRole("article", { name: "Seele" });
    await user.click(
      within(seele).getByRole("button", { name: /^Light Cone/ })
    );
    const picker = await screen.findByRole("dialog", { name: "Light Cone" });
    const results = picker.querySelector("[data-picker-results]");
    if (!(results instanceof HTMLElement)) throw new Error("Missing results");
    const names = within(results)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    // The Hunt first; any Character can still equip a Preservation one.
    expect(names.indexOf("In the Night")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("Moment of Victory")).toBeGreaterThan(
      names.indexOf("In the Night")
    );
    await user.click(within(picker).getByRole("button", { name: "The Hunt" }));
    expect(
      within(results).queryByRole("button", { name: "Moment of Victory" })
    ).toBeNull();
    expect(
      within(results).getByRole("button", { name: "In the Night" })
    ).toBeInTheDocument();
  }, 30_000);

  it("drops an unknown team from the URL", async () => {
    seed(seedTeam("team:a", ["1102"]));
    renderPage(`${APP_PATHS.teamChoice}?team=team%3Amissing`);
    expect(await grid()).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        new RegExp(`^${APP_PATHS.teamDamage}\\?mode=builds$`)
      )
    );
  });

  it("edits members from the roster and shows their conditions", async () => {
    const user = userEvent.setup();
    const team = seedTeam("team:ui-test", ["1102", "1309"]);
    team.cycles = 2;
    seed(team);
    renderPage(`${APP_PATHS.teamDamage}?team=team%3Aui-test`);

    const roster = await screen.findByRole(
      "region",
      { name: "Team Roster" },
      { timeout: 15_000 }
    );
    const seele = within(roster).getByRole("article", { name: "Seele" });
    expect(
      within(seele).getByRole("combobox", { name: "Relics" })
    ).toHaveTextContent("Ideal");

    await user.click(within(seele).getByRole("combobox", { name: "Eidolon" }));
    await user.click(await screen.findByRole("option", { name: "E2" }));
    expect(useTeamStore.getState().teams[0]?.members[0]?.eidolon).toBe(2);

    await user.click(
      within(seele).getByRole("combobox", { name: "Skill use" })
    );
    await user.click(
      await screen.findByRole("option", { name: "Prefer Skill" })
    );
    expect(useTeamStore.getState().teams[0]?.members[0]?.skill).toBe("prefer");

    expect(
      await within(seele).findByRole(
        "group",
        { name: "Conditions" },
        { timeout: 30_000 }
      )
    ).toBeInTheDocument();

    // Only the first empty slot is a picker; Battle Setup edits the team.
    expect(
      within(roster).getAllByRole("button", { name: "Add Character" })
    ).toHaveLength(1);
    const setup = screen.getByRole("region", { name: "Battle Setup" });
    await user.click(within(setup).getByRole("radio", { name: /Single boss/ }));
    expect(useTeamStore.getState().teams[0]?.scenario).toBe("singleBoss");

    await user.click(
      within(seele).getByRole("button", { name: /Character actions/ })
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Use account Eidolon" })
    );
    expect(
      useTeamStore.getState().teams[0]?.members[0]?.eidolon
    ).toBeUndefined();
    await user.click(
      within(seele).getByRole("button", { name: /Character actions/ })
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Remove from team" })
    );
    expect(
      useTeamStore
        .getState()
        .teams[0]?.members.map((member) => member?.characterId ?? null)
    ).toEqual(["1309", null, null, null]);
  }, 60_000);

  it("duplicates and deletes the open team from the app bar", async () => {
    const user = userEvent.setup();
    seed(seedTeam("team:a", ["1102"]));
    renderPage(`${APP_PATHS.teamDamage}?team=team%3Aa`);
    await screen.findByRole("heading", { level: 2, name: "Team 1" });
    const [appbar] = screen.getAllByRole("banner");
    if (!appbar) throw new Error("Missing app bar");
    await user.click(within(appbar).getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate team" }));
    expect(teamIds()).toHaveLength(2);
    const copyId = teamIds().find((id) => id !== "team:a");
    if (!copyId) throw new Error("Missing duplicated team");
    // The store mutation is synchronous, but opening the duplicated detail
    // commits through the router. Wait for that detail, not just any URL change.
    await screen.findByRole(
      "heading",
      { level: 2, name: "Team 2" },
      { timeout: 15_000 }
    );
    const location = screen.getByTestId("location");
    expect(location).not.toHaveTextContent("team%3Aa");
    expect(
      new URL(
        location.textContent ?? "",
        "https://example.test"
      ).searchParams.get("team")
    ).toBe(copyId);
    expect(useTeamStore.getState().activeTeamId).toBe(copyId);

    await user.click(within(appbar).getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete team" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete team",
      })
    );
    expect(teamIds()).toEqual(["team:a"]);
    expect(await grid()).toBeInTheDocument();
  }, 30_000);
});
