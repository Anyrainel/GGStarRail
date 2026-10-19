import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { I18nProvider } from "@/i18n/I18nContext";
import { ScoreUpView } from "@/pages/game-account/ScoreUpView";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "../../fixtures/demoAccount";

function renderPage(query = "") {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter
          initialEntries={[`/account-data/recommendations${query}`]}
        >
          <ScoreUpView />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

async function prepare() {
  const account = await createDemoAccount();
  const character = account.characters[0]!;
  const equipped = account.relics.filter(
    (entry) => entry.equippedCharacterKey === character.key
  );
  account.relics = account.relics
    .filter((entry) => entry.equippedCharacterKey)
    .map((entry) =>
      entry.equippedCharacterKey === character.key
        ? { ...entry, level: 0 }
        : entry
    );
  account.relics.push(
    ...equipped.map(({ equippedCharacterKey: _owner, ...entry }) => ({
      ...entry,
      key: `${entry.key}:upgrade`,
      level: 15,
    }))
  );
  const bySlot = new Map(equipped.map((entry) => [entry.slot, entry]));
  const profile: ScoreProfile = {
    id: "score:recommendations-ui",
    includeMainStat: true,
    mainStatWeight: 1,
    statWeights: {},
    gradeThresholds: { s: 80, a: 60, b: 40, c: 20 },
  };
  const cavern: BuildConfiguration = {
    id: "build:recommendations-ui-cavern",
    name: "Outer four",
    characterDefinitionId: character.definitionId,
    category: "cavern",
    scoreProfileId: profile.id,
    cavern: { mode: "four-piece", setId: bySlot.get("head")!.setId },
    preferredMainStats: {
      body: [bySlot.get("body")!.mainStat.statId],
      feet: [bySlot.get("feet")!.mainStat.statId],
    },
  };
  const planar: BuildConfiguration = {
    id: "build:recommendations-ui-planar",
    name: "Inner pair",
    characterDefinitionId: character.definitionId,
    category: "planar",
    scoreProfileId: profile.id,
    planarSetId: bySlot.get("planarSphere")!.setId,
    preferredMainStats: {
      planarSphere: [bySlot.get("planarSphere")!.mainStat.statId],
      linkRope: [bySlot.get("linkRope")!.mainStat.statId],
    },
  };
  useWorkspaceStore.getState().replaceAccount(account);
  useWorkspaceStore.getState().replaceBuildWorkspace({
    builds: [cavern, planar],
    scoreProfiles: [profile],
    triageRules: useWorkspaceStore.getState().triageRules,
  });
  return { account, character, cavern, planar };
}

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("Score Up", () => {
  it("offers both import and build entry points without account data", async () => {
    renderPage();
    expect(
      await screen.findByText("Import account data and configure builds")
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Character Builds" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Import game account" })
    ).toBeVisible();
  });

  it("shows separate 4 + 2 groups and applies a six-slot proposal without changing other Characters", async () => {
    const { account, character, planar } = await prepare();
    renderPage(`?character=${character.definitionId}&build=${planar.id}`);
    const user = userEvent.setup();
    const apply = await screen.findByRole("button", {
      name: "Apply to account data",
    });
    expect(apply).toBeEnabled();
    expect(
      screen.getByRole("combobox", { name: "Planar Ornaments · 2 slots" })
    ).toHaveTextContent("Inner pair");
    expect(
      document.querySelectorAll(
        '[data-recommendation-loadout="recommended"] [data-recommendation-slot]'
      )
    ).toHaveLength(6);
    expect(
      document.querySelectorAll(
        '[data-recommendation-loadout="current"] [data-recommendation-slot]'
      )
    ).toHaveLength(6);
    expect(screen.getAllByText("Cavern Relics · 4 slots")).toHaveLength(3);
    expect(screen.getAllByText("Planar Ornaments · 2 slots")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(await screen.findByText(/Only unequipped Relics/)).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await user.click(apply);
    await waitFor(() =>
      expect(screen.getByText("This loadout is already equipped")).toBeVisible()
    );
    expect(apply).toBeDisabled();
    const updated = useWorkspaceStore.getState().account!;
    expect(updated.characters[0]!.relicKeys).toHaveLength(6);
    expect(
      updated.characters[0]!.relicKeys.every((key) => key.endsWith(":upgrade"))
    ).toBe(true);
    expect(updated.characters.slice(1)).toEqual(account.characters.slice(1));
    expect(
      updated.relics.filter(
        (entry) =>
          entry.equippedCharacterKey &&
          entry.equippedCharacterKey !== character.key
      )
    ).toEqual(
      account.relics.filter(
        (entry) =>
          entry.equippedCharacterKey &&
          entry.equippedCharacterKey !== character.key
      )
    );
  });

  it("disables applying an incomplete pair and links to resource planning", async () => {
    const { account, character } = await prepare();
    account.relics = account.relics.filter(
      (entry) =>
        !(
          entry.slot === "linkRope" &&
          (!entry.equippedCharacterKey ||
            entry.equippedCharacterKey === character.key)
        )
    );
    account.characters[0]!.relicKeys = account.characters[0]!.relicKeys.filter(
      (key) => account.relics.some((entry) => entry.key === key)
    );
    useWorkspaceStore.getState().replaceAccount(account);
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Apply to account data" })
    ).toBeDisabled();
    expect(
      screen.getByText("No complete 4 + 2 loadout available")
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Upgrade & resource planning" })
    ).toHaveAttribute(
      "href",
      `/account-data/resources?character=${character.definitionId}`
    );
  });
});
