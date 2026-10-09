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
import App from "@/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "./fixtures/demoAccount";

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

function metricValue(label: string): number {
  const labelNode = screen.getByText(label);
  const value = labelNode.nextElementSibling?.textContent;
  if (value === undefined || value === null) {
    throw new Error(`Metric value missing for ${label}`);
  }
  return Number(value);
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
      screen.getAllByRole("button", { name: "Add Cavern build" })[0]
    );
    expect(screen.queryByRole("dialog", { name: "Add Build" })).toBeNull();
    expect(useWorkspaceStore.getState().builds).toHaveLength(1);
    expect(useWorkspaceStore.getState().builds[0]).toMatchObject({
      characterDefinitionId: character.id,
      cavern: { mode: "four-piece", setId: cavern.id },
      category: "cavern",
    });
    await user.click(
      screen.getAllByRole("button", { name: "Add Planar build" })[0]
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
      screen.getByRole("button", { name: /^Cavern 4-piece set:/ })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Planar 2-piece set:/ })
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

  it("switches a derived slot filter and opens the full recommendation view", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.filters);

    expect(await screen.findByText("Cavern Relics")).toBeVisible();
    expect(screen.getByText("Planar Ornaments")).toBeVisible();
    expect(screen.getByText("Recommended loadout")).toBeVisible();

    const bodyRule = screen.getByRole("button", {
      name: /^Body .*matches/,
    });
    await user.click(bodyRule);
    expect(bodyRule).toHaveAttribute("aria-pressed", "true");
    expect(within(bodyRule).getByText("Desired substats")).toBeVisible();
    expect(within(bodyRule).getByText("Must-have substats")).toBeVisible();

    const matchesOnly = screen.getByRole("checkbox", {
      name: /Show matches only/,
    });
    await user.click(matchesOnly);
    expect(matchesOnly).not.toBeChecked();
    expect(
      screen.getAllByText(/Matches|Does not match/).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Wrong slot").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/HP%|ATK%|DEF%/).length).toBeGreaterThan(0);
  });

  it("updates triage thresholds and filters the explained decisions", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.triage);

    const keepThreshold = await screen.findByRole("spinbutton", {
      name: "Keep at or above",
    });
    fireEvent.change(keepThreshold, { target: { value: "95" } });
    await waitFor(() => {
      expect(useWorkspaceStore.getState().triageRules.keepScoreAtLeast).toBe(
        95
      );
    });

    const salvageFilter = screen.getByRole("button", {
      name: "Filter triage decisions: Salvage review",
    });
    await user.click(salvageFilter);
    expect(salvageFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Triage results")).toBeVisible();
  });

  it("previews per-reason manager actionability without applying an unconnected task", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.triage);
    const apply = await screen.findByRole("button", { name: "Apply to game" });
    expect(apply).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Prepare preview" }));
    await waitFor(() => expect(metricValue("Instructions")).toBeGreaterThan(0));
    const instructionCount = metricValue("Instructions");
    expect(metricValue("Preview only")).toBe(instructionCount);
    expect(metricValue("Actionable")).toBe(0);
    expect(metricValue("Unknown prior state")).toBe(instructionCount);
    expect(metricValue("Equipped pieces")).toBeGreaterThan(0);
    expect(metricValue("Ambiguous matchers")).toBe(0);
    expect(apply).toBeDisabled();
    expect(screen.getByText(/reason counts may overlap/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
  });

  it("shows locked discard candidates as blocked with protection disabled", async () => {
    await prepareBuildWorkspace();
    const state = useWorkspaceStore.getState();
    const account = state.account;
    if (!account) throw new Error("Prepared account missing");
    const candidate = account.relics.find(
      (relic) => !relic.equippedCharacterKey && relic.discarded !== true
    );
    if (!candidate) throw new Error("Unequipped demo Relic missing");
    state.replaceAccount({
      ...account,
      relics: account.relics.map((relic) =>
        relic.key === candidate.key
          ? { ...relic, setId: "manager-locked-guard", locked: true }
          : relic
      ),
      source: { ...account.source, provider: "scanner-export" },
    });
    state.setTriageRules({ ...state.triageRules, protectLocked: false });
    const user = userEvent.setup();
    renderRoute(APP_PATHS.triage);
    expect(
      await screen.findByRole("checkbox", { name: /^Protect locked Relics/ })
    ).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Prepare preview" }));
    await waitFor(() => expect(metricValue("Locked before discard")).toBe(1));
    expect(metricValue("Preview only")).toBeGreaterThanOrEqual(1);
    expect(metricValue("Blocked locked discards")).toBe(1);
    expect(
      screen.getByText(/Locked pieces are never marked for discard/i)
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Apply to game" })
    ).toBeDisabled();
  });
});
