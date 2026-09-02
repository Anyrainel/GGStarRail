import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { APP_PATHS } from "@/config/navigation";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import { characterCatalogName } from "@/lib/catalogPresentation";
import { createDemoAccount } from "@/lib/demoAccount";
import CharacterView from "@/pages/account-data/CharacterView";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function renderView() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <CharacterView />
      </MemoryRouter>
    </I18nProvider>
  );
}

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("Account Character loadouts", () => {
  it("keeps the fresh-state demo handoff on the parity view", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Load demo account" }));

    expect(
      await screen.findAllByRole("article", { name: / loadout$/ })
    ).toHaveLength(6);
  });

  it("shows the Light Cone, all six Relic slots, set summary, and build scores", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
      loadBuildReferences(),
    ]);
    const ownedCharacter = account.characters[0];
    if (!ownedCharacter) throw new Error("Demo Character missing");
    const definition = references.characters.byId.get(
      ownedCharacter.definitionId
    );
    if (!definition) throw new Error("Character reference missing");
    const profile = createCharacterScoreProfile(
      definition,
      references.progression,
      "Account card score",
      "score:account-card"
    );
    const build = createCharacterBuild(
      definition,
      ownedCharacter.key,
      account.relics,
      references.relicSets.values,
      references.properties,
      references.progression,
      profile.id,
      "Account card build",
      "build:account-card"
    );
    const workspace = useWorkspaceStore.getState();
    workspace.replaceAccount(account);
    workspace.replaceBuildWorkspace({
      builds: [build],
      scoreProfiles: [profile],
      triageRules: workspace.triageRules,
    });
    const name = characterCatalogName(definition, "en", "Trailblazer");

    renderView();

    const card = await screen.findByRole("article", {
      name: `${name} loadout`,
    });
    expect(
      within(card).getByRole("region", { name: "Light Cone" })
    ).toBeVisible();
    expect(
      within(card).getByRole("region", { name: "Equipped set summary" })
    ).toBeVisible();
    expect(within(card).getByText("Cavern Relic sets")).toBeVisible();
    expect(within(card).getByText("Planar Ornament sets")).toBeVisible();
    expect(card.querySelectorAll("[data-relic-slot]")).toHaveLength(6);
    expect(card.querySelectorAll("[data-relic-score]")).toHaveLength(6);
    expect(card.querySelector("[data-aggregate-score]")).toBeVisible();
    expect(
      within(card).getByText("Scored against Account card build")
    ).toBeVisible();
    expect(
      within(card).getByRole("link", {
        name: `Open ${name} in the Character Archive`,
      })
    ).toHaveAttribute(
      "href",
      `${APP_PATHS.archiveCharacters}?character=${ownedCharacter.definitionId}`
    );
  });

  it("filters the roster and restores it with the compact filter panel", async () => {
    useWorkspaceStore.getState().replaceAccount(await createDemoAccount());
    const user = userEvent.setup();
    renderView();

    const search = await screen.findByRole("searchbox", { name: "Search" });
    await user.type(search, "no-such-character");
    expect(
      await screen.findByText("No items match these filters.")
    ).toBeVisible();

    const clear = screen.getByRole("button", { name: "Clear filters" });
    await user.click(clear);
    await waitFor(() => {
      expect(screen.queryByText("No items match these filters.")).toBeNull();
    });
    expect(screen.getAllByRole("article", { name: / loadout$/ })).toHaveLength(
      6
    );
  });
});
