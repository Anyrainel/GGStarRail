import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/app/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "../../fixtures/demoAccount";

function renderRoute(path: string) {
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

async function prepareBuildWorkspace() {
  const [account, references] = await Promise.all([
    createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
    loadBuildReferences(),
  ]);
  const ownedCharacter = account.characters[0];
  if (!ownedCharacter) throw new Error("Demo character missing");
  const character = references.characters.byId.get(ownedCharacter.definitionId);
  if (!character) throw new Error("Character reference missing");
  const profile = createCharacterScoreProfile(
    character,
    references.progression,
    "Route test score",
    "score:route-test"
  );
  const build = createCharacterBuild(
    character,
    {
      category: "cavern",
      cavern: {
        mode: "four-piece",
        setId: account.relics.find(
          (relic) =>
            relic.equippedCharacterKey === ownedCharacter.key &&
            relic.slot === "head"
        )!.setId,
      },
    },
    references.properties,
    references.progression,
    profile.id,
    "Route test build",
    "build:route-test"
  );
  useWorkspaceStore.getState().replaceAccount(account);
  useWorkspaceStore.getState().replaceBuildWorkspace({
    builds: [build],
    scoreProfiles: [profile],
    triageRules: useWorkspaceStore.getState().triageRules,
  });
}

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("Build route interactions", () => {
  it("creates independent Cavern and Planar cards directly", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values[0];
    const cavern = references.relicSets.values.find(
      (set) => set.kind === "cavern_relic"
    );
    const planar = references.relicSets.values.find(
      (set) => set.kind === "planar_ornament"
    );
    if (!character || !cavern || !planar)
      throw new Error("Catalog fixture missing");
    const user = userEvent.setup();
    renderRoute(APP_PATHS.builds);
    await user.type(
      await screen.findByRole("searchbox", { name: "Search" }),
      character.id
    );
    await user.click(
      screen.getAllByRole("button", { name: "Add Cavern Relic build" })[0]
    );
    expect(screen.queryByRole("dialog", { name: "Add Build" })).toBeNull();
    expect(useWorkspaceStore.getState().builds).toHaveLength(1);
    expect(useWorkspaceStore.getState().builds[0]).toMatchObject({
      characterDefinitionId: character.id,
      cavern: { mode: "four-piece", setId: cavern.id },
      category: "cavern",
    });
    await user.click(
      screen.getAllByRole("button", { name: "Add Planar Ornament build" })[0]
    );
    expect(useWorkspaceStore.getState().builds[1]).toMatchObject({
      category: "planar",
      planarSetId: planar.id,
    });
    expect(useWorkspaceStore.getState().account).toBeNull();
  });

  it("configures a Cavern card with two variable slots and edits its scoring profile", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.builds);

    expect(
      await screen.findByRole("textbox", { name: "Build name" })
    ).toHaveValue("Route test build");
    expect(
      screen.getByRole("checkbox", { name: /Owned Characters only/ })
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: /^Cavern Relic set: .* 4-piece$/ })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Planar Ornament set:/ })
    ).toBeNull();
    expect(document.querySelectorAll("[data-build-slot]")).toHaveLength(2);
    expect(screen.queryByText("Fixed main stat")).not.toBeInTheDocument();

    const buildCard = document.querySelector("[data-build-card]");
    if (!buildCard) throw new Error("Build card missing");
    await user.click(
      within(buildCard as HTMLElement).getByRole("button", { name: "More" })
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Configure scoring weights and grade thresholds",
      })
    );

    const hpFlat = screen.getByRole("slider", { name: "HP" });
    const hpRatio = screen.getByRole("slider", { name: "HP%" });
    expect(screen.getByRole("slider", { name: "ATK" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "ATK%" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "DEF" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "DEF%" })).toBeVisible();
    expect(hpFlat).not.toBe(hpRatio);
    fireEvent.change(hpRatio, { target: { value: "77" } });
    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().scoreProfiles[0]?.statWeights.HPAddedRatio
      ).toBe(0.77);
    });

    const profileName = screen.getByRole("textbox", { name: "Profile name" });
    await user.clear(profileName);
    await user.type(profileName, "Edited route score");
    await user.tab();

    await waitFor(() => {
      expect(useWorkspaceStore.getState().scoreProfiles[0]?.name).toBe(
        "Edited route score"
      );
    });
  }, 15_000);

  it("keeps catalog builds and scoring editable without account data", async () => {
    await prepareBuildWorkspace();
    act(() => useWorkspaceStore.setState({ account: null }));
    const user = userEvent.setup();
    renderRoute(APP_PATHS.builds);

    expect(
      await screen.findByRole("textbox", { name: "Build name" })
    ).toHaveValue("Route test build");
    expect(
      screen.getByRole("checkbox", { name: /Owned Characters only/ })
    ).toBeDisabled();
    const buildCard = document.querySelector("[data-build-card]");
    if (!buildCard) throw new Error("Build card missing");
    await user.click(
      within(buildCard as HTMLElement).getByRole("button", { name: "More" })
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Configure scoring weights and grade thresholds",
      })
    );
    expect(screen.getByRole("slider", { name: "HP%" })).toBeVisible();
  });

  it("switches a slot column and lists the account candidates for it", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.filters);

    expect(
      await screen.findByRole("combobox", { name: "Cavern Relics" })
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Planar Ornaments" })
    ).toBeVisible();
    expect(screen.getByText("Recommended loadout")).toBeVisible();
    expect(screen.queryByText(/Stats weighted at 60%/)).toBeNull();
    expect(screen.queryByText("Up to 18 results.")).toBeNull();
    expect(
      within(document.querySelector("header")!).queryByRole("button", {
        name: "Import",
      })
    ).toBeInTheDocument();

    const cavernCard = document.querySelector(
      '[data-filter-set-card="cavern"]'
    ) as HTMLElement;
    const slots = [...cavernCard.querySelectorAll("[data-filter-slot]")].map(
      (slot) => slot.getAttribute("data-filter-slot")
    );
    expect(slots).toEqual(["head", "hands", "body", "feet"]);
    const fixedMains = within(cavernCard).getAllByTitle("Fixed");
    expect(fixedMains.map((cell) => cell.textContent)).toEqual(["HP", "ATK"]);
    expect(within(cavernCard).getAllByText(/at least \d/).length).toBe(4);
    expect(
      document.querySelectorAll("[data-filter-loadout] [data-relic-slot]")
    ).toHaveLength(6);

    const bodyRule = within(cavernCard).getByRole("button", {
      name: /^Body, \d+ match(es)?$/,
    });
    await user.click(bodyRule);
    expect(bodyRule).toHaveAttribute("aria-pressed", "true");
    const candidates = document.querySelector(
      "[data-filter-candidates]"
    ) as HTMLElement;
    expect(within(candidates).getAllByText("Body")[0]).toBeVisible();

    const matchesOnly = screen.getByRole("checkbox", {
      name: /Show matches only/,
    });
    await user.click(matchesOnly);
    expect(matchesOnly).not.toBeChecked();
    expect(
      within(candidates).getAllByText(/Matches|Does not match/).length
    ).toBeGreaterThan(0);
    expect(
      within(candidates).getAllByText("Wrong slot").length
    ).toBeGreaterThan(0);
    expect(within(candidates).queryByText("Slot matched")).toBeNull();
    expect(
      candidates.querySelectorAll('[data-relic-score-card="nested"]').length
    ).toBeGreaterThan(0);
  });

  it("selects a Character with builds from the Relic Filters sidebar", async () => {
    await prepareBuildWorkspace();
    const references = await loadBuildReferences();
    const state = useWorkspaceStore.getState();
    const second = references.characters.values.find(
      (character) => character.id !== state.builds[0]!.characterDefinitionId
    )!;
    const profile = createCharacterScoreProfile(
      second,
      references.progression,
      "Second score",
      "score:second"
    );
    const planar = createCharacterBuild(
      second,
      {
        category: "planar",
        planarSetId: references.relicSets.values.find(
          (set) => set.kind === "planar_ornament"
        )!.id,
      },
      references.properties,
      references.progression,
      profile.id,
      "Second planar",
      "build:second-planar"
    );
    act(() =>
      useWorkspaceStore.getState().replaceBuildWorkspace({
        builds: [...state.builds, planar],
        scoreProfiles: [...state.scoreProfiles, profile],
        triageRules: state.triageRules,
      })
    );
    const user = userEvent.setup();
    renderRoute(APP_PATHS.filters);
    const list = await screen.findByRole("group", { name: "Character" });
    const rows = within(list).getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
    await user.click(rows[1]!);
    expect(rows[1]).toHaveAttribute("aria-pressed", "true");
    expect(
      document.querySelector('[data-filter-set-card="cavern"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-filter-set-card="planar"]')
    ).not.toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Cavern Relics" })
    ).toBeDisabled();
  });

  it("opens Character Builds on a deep-linked Character", async () => {
    await prepareBuildWorkspace();
    const references = await loadBuildReferences();
    const owned = new Set(
      useWorkspaceStore
        .getState()
        .account?.characters.map(({ definitionId }) => definitionId)
    );
    const names = references.characters.values.map(
      (character) => character.name.en.value
    );
    // A Character whose name is not part of any other name, so the search is exact.
    const unowned = references.characters.values.find(
      (character) =>
        !owned.has(character.id) &&
        !character.id.startsWith("8") &&
        names.filter((name) => name.includes(character.name.en.value))
          .length === 1
    )!;
    renderRoute(`${APP_PATHS.builds}?character=${unowned.id}`);
    await waitFor(() =>
      expect(
        document.querySelectorAll("[data-character-build-card]")
      ).toHaveLength(1)
    );
    expect(
      document.querySelector("[data-character-build-card]")
    ).toHaveAttribute("data-character-build-card", unowned.id);
    expect(
      screen.getByRole("checkbox", { name: /Owned Characters only/ })
    ).not.toBeChecked();
  });

  it("offers Clear all when the catalog filters match nothing", async () => {
    const user = userEvent.setup();
    renderRoute(APP_PATHS.builds);
    await user.type(
      await screen.findByRole("searchbox", { name: "Search" }),
      "no character has this name"
    );
    expect(await screen.findByText("No matching Characters")).toBeVisible();
    const list = document.querySelector(
      "[data-character-build-list]"
    ) as HTMLElement;
    await user.click(within(list).getByRole("button", { name: "Clear all" }));
    expect((await screen.findAllByRole("article")).length).toBeGreaterThan(0);
  });
});
