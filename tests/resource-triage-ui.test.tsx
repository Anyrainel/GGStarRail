import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { AccountSnapshot } from "@/domain/account/schemas";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import { createDemoAccount } from "@/lib/demoAccount";
import { ResourceView } from "@/pages/account-data/ResourceView";
import { TriageView } from "@/pages/account-data/TriageView";
import { useResourceSettingsStore } from "@/stores/useResourceSettingsStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function renderView(view: React.ReactNode) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter>{view}</MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

async function prepareBuildWorkspace(accountOverride?: AccountSnapshot) {
  const [baseAccount, references] = await Promise.all([
    createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
    loadBuildReferences(),
  ]);
  const account = accountOverride ?? baseAccount;
  const ownedCharacter = account.characters[0];
  if (!ownedCharacter) throw new Error("Demo character missing");
  const character = references.characters.byId.get(ownedCharacter.definitionId);
  if (!character) throw new Error("Character reference missing");
  const profile = createCharacterScoreProfile(
    character,
    references.progression,
    "Resource UI score",
    "score:resource-ui"
  );
  const build = createCharacterBuild(
    character,
    ownedCharacter.key,
    account.relics,
    references.relicSets.values,
    references.properties,
    references.progression,
    profile.id,
    "Resource UI build",
    "build:resource-ui"
  );
  const workspace = useWorkspaceStore.getState();
  workspace.replaceAccount(account);
  workspace.replaceBuildWorkspace({
    builds: [build],
    scoreProfiles: [profile],
    triageRules: workspace.triageRules,
  });
  return account;
}

afterEach(() => {
  act(() => {
    useWorkspaceStore.getState().clearWorkspace();
    useResourceSettingsStore.getState().resetSettings();
  });
});

describe("Resource and Relic Triage views", () => {
  it("presents HSR resource actions, both equipment categories, and advisory limits", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderView(<ResourceView />);

    expect(
      await screen.findByRole("heading", { name: "Resources", hidden: true })
    ).toBeInTheDocument();
    expect((await screen.findAllByText("Level Relics")).length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText("Synthesize Relics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Use Variable Dice").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/GGStarRail does not know your consumable balances/)
    ).toBeVisible();
    expect((await screen.findAllByRole("article")).length).toBeGreaterThan(0);
    expect(
      document.querySelector("[data-item-icon-kind='relic-piece']")
    ).not.toBeNull();
    expect(
      document.querySelector(
        "[data-item-icon-kind='relic-piece'][data-item-level]"
      )
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Planar Ornament" }));
    await waitFor(() => {
      const cards = screen.getAllByRole("article");
      expect(cards.length).toBeGreaterThan(0);
      expect(
        cards.every((card) =>
          within(card).queryByText("Planar Ornament", { exact: true })
        )
      ).toBe(true);
    });
  });

  it("renders the entire Cavern and Planar triage catalog and filters it without a cap", async () => {
    const baseAccount = await createDemoAccount(
      new Date("2026-09-02T00:00:00.000Z")
    );
    const template = baseAccount.relics.find(
      (relic) => relic.equippedCharacterKey === undefined
    );
    if (!template) throw new Error("Demo spare Relic missing");
    const copies = Array.from({ length: 65 }, (_, index) => ({
      ...template,
      key: `resource-ui-relic:${index + 1}`,
      slot: index % 2 === 0 ? ("head" as const) : ("planarSphere" as const),
      locked: false,
      discarded: false,
      equippedCharacterKey: undefined,
    }));
    const account = {
      ...baseAccount,
      relics: [...baseAccount.relics, ...copies],
    };
    await prepareBuildWorkspace(account);
    const user = userEvent.setup();
    renderView(<TriageView />);

    expect(
      await screen.findByRole("heading", {
        name: "Relic Triage",
        hidden: true,
      })
    ).toBeInTheDocument();
    const allCards = await screen.findAllByRole("article");
    expect(allCards).toHaveLength(account.relics.length);
    expect(
      allCards[0]?.querySelector("[data-item-icon-kind='relic-piece']")
    ).toHaveAttribute("data-item-level");
    expect(
      screen.getByRole("button", { name: "Download instructions" })
    ).toBeDisabled();

    const planarCount = account.relics.filter(
      (relic) => relic.slot === "planarSphere" || relic.slot === "linkRope"
    ).length;
    await user.click(screen.getByRole("button", { name: /Planar Ornaments/ }));
    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(planarCount);
    });
    expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument();
  });
});
