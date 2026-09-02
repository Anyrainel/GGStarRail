import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_PATHS } from "@/config/navigation";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import {
  characterCatalogName,
  formatAccountStatValue,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
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
    const cardBuild = {
      ...build,
      preferredMainStats: {
        ...build.preferredMainStats,
        body: ["test:off-target-main"],
      },
    };
    const workspace = useWorkspaceStore.getState();
    workspace.replaceAccount(account);
    workspace.replaceBuildWorkspace({
      builds: [cardBuild],
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
    const equipmentRow = card.querySelector("[data-character-equipment-row]");
    if (!(equipmentRow instanceof HTMLElement)) {
      throw new Error("Character equipment row missing");
    }
    expect(
      equipmentRow.querySelector("[data-item-icon-kind='character']")
    ).toBeVisible();
    expect(
      equipmentRow.querySelector("[data-item-icon-kind='light-cone']")
    ).toBeVisible();
    expect(
      equipmentRow.contains(
        within(card).getByRole("region", { name: "Light Cone" })
      )
    ).toBe(true);
    expect(within(equipmentRow).queryByText("Light Cone")).toBeNull();
    expect(within(card).queryByText(/^Level \d+$/)).toBeNull();
    expect(within(card).queryByText(/^Superimposition \d+$/)).toBeNull();
    expect(
      within(card).getByRole("region", { name: "Equipped set summary" })
    ).toBeVisible();
    expect(within(card).getByText("Cavern Relic sets")).toBeInTheDocument();
    expect(within(card).getByText("Planar Ornament sets")).toBeInTheDocument();
    expect(card.querySelectorAll("[data-relic-slot]")).toHaveLength(6);
    expect(
      within(card).getByRole("region", { name: "Equipped Relics" })
    ).toHaveClass("grid-cols-6");
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

    const firstRelic = account.relics.find(
      (relic) => relic.key === ownedCharacter.relicKeys[0]
    );
    if (!firstRelic) throw new Error("Equipped demo Relic missing");
    const relicColumn = card.querySelector(
      `[data-relic-slot='${firstRelic.slot}']`
    );
    if (!(relicColumn instanceof HTMLElement)) {
      throw new Error("Relic stat column missing");
    }
    const mainStatRow = relicColumn.querySelector("[data-main-stat-row]");
    expect(mainStatRow).toHaveTextContent(`+${firstRelic.level}`);
    for (const substat of firstRelic.substats) {
      expect(
        within(relicColumn).getByText(
          localizedPropertyName(substat.statId, references.properties, "en")
        )
      ).toBeVisible();
      expect(
        within(relicColumn).getByText(
          formatAccountStatValue(
            substat.value,
            references.properties.propertyById.get(substat.statId),
            "en"
          )
        )
      ).toBeVisible();
    }

    const offTargetColumn = card.querySelector("[data-relic-slot='body']");
    if (!(offTargetColumn instanceof HTMLElement)) {
      throw new Error("Off-target Relic stat column missing");
    }
    const offTargetMessage =
      "Ungraded because this configurable main stat is not accepted by the selected build.";
    expect(
      within(offTargetColumn).getByRole("img", { name: offTargetMessage })
    ).toBeVisible();
    expect(
      within(offTargetColumn).getByRole("progressbar", {
        name: "Body Relic slot",
      })
    ).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining(offTargetMessage)
    );

    const emptyCharacter = account.characters.find(
      (character) => character.relicKeys.length === 0
    );
    if (!emptyCharacter) throw new Error("Demo empty loadout missing");
    const emptyDefinition = references.characters.byId.get(
      emptyCharacter.definitionId
    );
    if (!emptyDefinition) throw new Error("Empty Character reference missing");
    const emptyCard = screen.getByRole("article", {
      name: `${characterCatalogName(emptyDefinition, "en", "Trailblazer")} loadout`,
    });
    const emptySlots = emptyCard.querySelectorAll("[data-relic-slot]");
    expect(emptySlots).toHaveLength(6);
    for (const slot of emptySlots) {
      expect(slot).toHaveClass("min-h-36");
      expect(slot).toHaveTextContent("Empty slot");
    }
  });

  it("filters the roster and restores it with the compact filter panel", async () => {
    useWorkspaceStore.getState().replaceAccount(await createDemoAccount());
    const user = userEvent.setup();
    renderView();

    await user.click(
      await screen.findByRole("button", { name: "Character filters" })
    );
    const filterDialog = screen.getByRole("dialog", {
      name: "Character filters",
    });
    const search = within(filterDialog).getByRole("searchbox", {
      name: "Search",
    });
    await user.type(search, "no-such-character");
    expect(
      await screen.findByText("No items match these filters.")
    ).toBeVisible();

    const clear = within(filterDialog).getByRole("button", {
      name: "Clear filters",
    });
    await user.click(clear);
    await waitFor(() => {
      expect(screen.queryByText("No items match these filters.")).toBeNull();
    });
    await user.click(
      within(filterDialog).getByRole("button", { name: "Close" })
    );
    expect(screen.getAllByRole("article", { name: / loadout$/ })).toHaveLength(
      6
    );
  });

  it("compacts the complete card at the initial two-column breakpoint and restores full density at 2048px", async () => {
    useWorkspaceStore.getState().replaceAccount(await createDemoAccount());
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query.includes("min-width: 1536px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const compactRender = renderView();
    const compactCard = (
      await screen.findAllByRole("article", {
        name: / loadout$/,
      })
    )[0];
    const compactCharacterIcon = compactCard.querySelector(
      "[data-item-icon-kind='character']"
    );
    const compactSetIcon = compactCard.querySelector(
      "[data-item-icon-kind='relic-set']"
    );
    const compactRelic = compactCard.querySelector("[data-relic-slot]");
    expect(compactCharacterIcon).toHaveStyle({ width: "56px" });
    expect(compactSetIcon).toHaveStyle({ width: "48px" });
    expect(compactRelic).toHaveClass("p-1");
    compactRender.unmount();

    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderView();
    const fullCard = (
      await screen.findAllByRole("article", {
        name: / loadout$/,
      })
    )[0];
    expect(
      fullCard.querySelector("[data-item-icon-kind='character']")
    ).toHaveStyle({ width: "64px" });
    expect(
      fullCard.querySelector("[data-item-icon-kind='relic-set']")
    ).toHaveStyle({ width: "56px" });
    expect(fullCard.querySelector("[data-relic-slot]")).toHaveClass("p-2");
  });
});
