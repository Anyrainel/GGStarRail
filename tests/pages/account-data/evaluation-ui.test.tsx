import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { EvaluationView } from "@/pages/game-account/EvaluationView";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "../../fixtures/demoAccount";

function renderView(path = "/account-data/evaluation") {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <EvaluationView />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

async function prepare() {
  const [account, references] = await Promise.all([
    createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
    loadBuildReferences(),
  ]);
  const owned = account.characters[0]!;
  const character = references.characters.byId.get(owned.definitionId)!;
  const profile = createCharacterScoreProfile(
    character,
    references.progression,
    "Evaluation",
    "score:evaluation"
  );
  const cavernSet = account.relics.find(
    (relic) => relic.slot === "head" && relic.equippedCharacterKey === owned.key
  )!.setId;
  const planarSet = account.relics.find(
    (relic) =>
      relic.slot === "planarSphere" && relic.equippedCharacterKey === owned.key
  )!.setId;
  const cavern = createCharacterBuild(
    character,
    { category: "cavern", cavern: { mode: "four-piece", setId: cavernSet } },
    references.properties,
    references.progression,
    profile.id,
    "Cavern target",
    "build:evaluation-cavern"
  );
  const planar = createCharacterBuild(
    character,
    { category: "planar", planarSetId: planarSet },
    references.properties,
    references.progression,
    profile.id,
    "Planar target",
    "build:evaluation-planar"
  );
  const state = useWorkspaceStore.getState();
  state.replaceAccount(account);
  state.replaceBuildWorkspace({
    builds: [cavern, planar],
    scoreProfiles: [profile],
    triageRules: state.triageRules,
  });
  return { cavern, planar };
}

afterEach(() => act(() => useWorkspaceStore.getState().clearWorkspace()));

describe("Build Evaluation", () => {
  it("offers account import and build setup before data is available", async () => {
    renderView();
    expect(
      await screen.findByText(
        "Import your account and configure builds to evaluate your Relics."
      )
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Character Builds" })
    ).toBeVisible();
  });

  it("shows four Cavern slots and two Planar slots with scoped follow-up actions", async () => {
    const { cavern, planar } = await prepare();
    const { container } = renderView();
    await screen.findByRole("heading", { name: "Build Evaluation" });
    await waitFor(() =>
      expect(
        container.querySelectorAll("[data-build-completion]")
      ).toHaveLength(2)
    );
    expect(
      container
        .querySelector(`[data-build-completion="${cavern.id}"]`)
        ?.querySelectorAll("[data-completion-slot]")
    ).toHaveLength(4);
    expect(
      container
        .querySelector(`[data-build-completion="${planar.id}"]`)
        ?.querySelectorAll("[data-completion-slot]")
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: "Improve build" })[0]
    ).toHaveAttribute(
      "href",
      `/account-data/recommendations?character=${cavern.characterDefinitionId}&build=build%3Aevaluation-cavern`
    );
    expect(
      screen.getAllByRole("link", { name: "Plan resources" })[1]
    ).toHaveAttribute(
      "href",
      `/account-data/resources?character=${planar.characterDefinitionId}&build=build%3Aevaluation-planar`
    );
    expect(screen.getByRole("combobox", { name: "Character" })).toBeVisible();
  });

  it("honors a linked build and lets the Character filter clear that build selection", async () => {
    const { planar } = await prepare();
    const { container } = renderView(
      `/account-data/evaluation?character=${planar.characterDefinitionId}&build=${encodeURIComponent(planar.id)}`
    );
    await waitFor(() =>
      expect(
        container.querySelectorAll("[data-build-completion]")
      ).toHaveLength(1)
    );
    expect(container.querySelectorAll("[data-completion-slot]")).toHaveLength(
      2
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Character" }));
    await user.click(screen.getByRole("option", { name: /^All$/ }));
    await waitFor(() =>
      expect(
        container.querySelectorAll("[data-build-completion]")
      ).toHaveLength(2)
    );
  });
});
