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
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { AccountSnapshot } from "@/domain/account/schemas";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { ResourceView } from "@/pages/account-data/ResourceView";
import { TriageView } from "@/pages/account-data/TriageView";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import { useResourceSettingsStore } from "@/stores/useResourceSettingsStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "../../fixtures/demoAccount";

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
    "Resource UI build",
    "build:resource-ui"
  );
  const workspace = useWorkspaceStore.getState();
  const planar = createCharacterBuild(
    character,
    {
      category: "planar",
      planarSetId: account.relics.find(
        (relic) =>
          relic.equippedCharacterKey === ownedCharacter.key &&
          relic.slot === "planarSphere"
      )!.setId,
    },
    references.properties,
    references.progression,
    profile.id,
    "Planar UI build",
    "build:resource-ui-planar"
  );
  workspace.replaceAccount(account);
  workspace.replaceBuildWorkspace({
    builds: [build, planar],
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

/** Reads a manager preview metric: each label is followed by its value. */
function metricValue(scope: HTMLElement, label: string): number {
  const value = within(scope).getByText(label).nextElementSibling?.textContent;
  if (value === undefined || value === null) {
    throw new Error(`Metric value missing for ${label}`);
  }
  return Number(value);
}

/** Counts result cards across every decision tab; expanded cards nest a stat article. */
async function countCardsAcrossTabs(user: ReturnType<typeof userEvent.setup>) {
  let total = 0;
  for (const tab of screen.getAllByRole("tab")) {
    await user.click(tab);
    await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
    total += screen
      .queryAllByRole("article")
      .filter((article) => !article.parentElement?.closest("article")).length;
  }
  return total;
}

describe("Resource and Relic Triage views", () => {
  it("presents HSR resource actions, both equipment categories, and advisory limits", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderView(<ResourceView />);

    expect((await screen.findAllByText("Level Relics")).length).toBeGreaterThan(
      0
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Resources" })
    ).toBeVisible();
    expect(screen.getAllByText("Synthesize Relics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Use Variable Dice").length).toBeGreaterThan(0);
    expect(screen.queryByText("Suggestion settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Opportunity")).not.toBeInTheDocument();

    // The advisory restriction lives in the help dialog, not the page body.
    expect(
      screen.queryByText(/GGArtifact does not know your consumable balances/)
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Help" }));
    const help = await screen.findByRole("dialog");
    expect(
      within(help).getByText(
        /GGArtifact does not know your consumable balances/
      )
    ).toBeVisible();
    expect(within(help).getByText(/100 Relic Remains/)).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );

    expect((await screen.findAllByRole("article")).length).toBeGreaterThan(0);
    expect(
      document.querySelector("[data-item-icon-kind='relic-piece']")
    ).not.toBeNull();
    expect(
      document.querySelector(
        "[data-item-icon-kind='relic-piece'][data-item-level]"
      )
    ).not.toBeNull();

    // Both kinds start on; turning Cavern off leaves only Planar Ornament slots.
    expect(
      screen.getByRole("button", { name: "Planar Ornament" })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Cavern Relic" }));
    await waitFor(() => {
      const cards = screen.getAllByRole("article");
      expect(cards.length).toBeGreaterThan(0);
      expect(
        cards.every((card) =>
          /Planar Sphere|Link Rope/.test(card.textContent ?? "")
        )
      ).toBe(true);
    });
    await user.click(screen.getByRole("button", { name: "Cavern Relic" }));

    // A priority group collapses to its header.
    const group = screen.getAllByRole("button", { expanded: true })[0]!;
    const groupSection = group.closest("section")!;
    expect(within(groupSection).getAllByRole("article").length).toBeGreaterThan(
      0
    );
    await user.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(within(groupSection).queryAllByRole("article")).toHaveLength(0);
    await user.click(group);

    // A row with an owned source Relic opens that Relic's stats; a synthesis
    // row has no Relic to show.
    expect(
      document.querySelector(
        "[data-resource-action='synthesize'] button[aria-haspopup='dialog']"
      )
    ).toBeNull();
    const levelUpRow = document.querySelector<HTMLElement>(
      "[data-resource-action='level-up'] button[aria-haspopup='dialog']"
    );
    if (!levelUpRow) throw new Error("Level-up row missing");
    await user.click(levelUpRow);
    const relicDialog = await screen.findByRole("dialog");
    expect(relicDialog.querySelector("[data-relic-substats]")).not.toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );

    // Hiding an action keeps its count, removes its rows, and saves the toggle.
    expect(
      document.querySelector("[data-resource-action='synthesize']")
    ).not.toBeNull();
    const synthesize = screen.getByRole("checkbox", {
      name: "Synthesize Relics",
    });
    const tile = synthesize.closest("[data-resource-toggle]");
    const countBefore = tile?.textContent;
    expect(countBefore).toMatch(/[1-9]\d*/);
    await user.click(synthesize);
    await waitFor(() =>
      expect(
        document.querySelector("[data-resource-action='synthesize']")
      ).toBeNull()
    );
    expect(tile?.textContent).toBe(countBefore);
    expect(
      useResourceSettingsStore.getState().settings.enabledActions.synthesize
    ).toBe(false);

    // The threshold beside an action edits the saved minimum headroom.
    const threshold = screen.getByRole("spinbutton", {
      name: "Minimum headroom for Use Variable Dice",
    });
    await user.clear(threshold);
    await user.type(threshold, "100");
    await user.tab();
    expect(
      useResourceSettingsStore.getState().settings.minimumScoreGap.reroll
    ).toBe(100);
  });

  it("renders the entire Cavern and Planar triage catalog in decision tabs and filters it without a cap", async () => {
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

    const tabs = await screen.findAllByRole("tab");
    expect(
      screen.getByRole("heading", { level: 1, name: "Relic Triage" })
    ).toBeVisible();
    expect(
      screen.getByText(`${account.relics.length} Relics analyzed:`)
    ).toBeInTheDocument();
    expect(tabs.map((tab) => tab.textContent?.replace(/\s*\d+$/, ""))).toEqual([
      "Keep",
      "Review",
      "Salvage review",
    ]);
    const firstCards = screen.getAllByRole("article");
    expect(
      firstCards[0]?.querySelector("[data-item-icon-kind='relic-piece']")
    ).toHaveAttribute("data-item-level");
    expect(screen.queryByText("Decision summary")).not.toBeInTheDocument();
    expect(await countCardsAcrossTabs(user)).toBe(account.relics.length);

    const detailToggle = within(screen.getAllByRole("article")[0]!).getByRole(
      "button",
      { expanded: false }
    );
    await user.click(detailToggle);
    expect(detailToggle).toHaveAttribute("aria-expanded", "true");
    expect(
      within(screen.getAllByRole("article")[0]!).getByText(
        /^Matches \d+ builds?$/
      )
    ).toBeInTheDocument();
    // Expansion belongs to the visual row, so reversing the order keeps the
    // first row open instead of moving the opened Relic to the end.
    await user.click(screen.getByRole("button", { name: "Score" }));
    const resorted = screen
      .getAllByRole("article")
      .filter((article) => !article.parentElement?.closest("article"));
    expect(resorted.length).toBeGreaterThan(1);
    expect(
      resorted.filter((card) =>
        within(card).queryByRole("button", { expanded: true })
      )
    ).toEqual([resorted[0]]);

    // Triage rules sit in a popover that shows their current values; opening
    // it does not focus a number input.
    await user.click(screen.getByRole("button", { name: "Rules (40% / 20%)" }));
    const protectLocked = await screen.findByRole("switch", {
      name: "Protect locked Relics",
    });
    expect(
      screen.getByRole("spinbutton", { name: "Keep at or above" })
    ).not.toHaveFocus();
    expect(protectLocked).toHaveAttribute("aria-checked", "true");
    await user.click(protectLocked);
    expect(useWorkspaceStore.getState().triageRules.protectLocked).toBe(false);
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(useWorkspaceStore.getState().triageRules.protectLocked).toBe(true);
    await user.keyboard("{Escape}");

    // Apply to game opens the manager with its restriction and a fresh preview.
    await user.click(screen.getByRole("button", { name: "Apply to game" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Applies lock and discard marks only/)
    ).toBeVisible();
    await waitFor(() =>
      expect(within(dialog).queryByText("Preparing…")).not.toBeInTheDocument()
    );
    expect(
      within(dialog).getByRole("button", { name: "Apply to game" })
    ).toBeDisabled();
    await user.click(
      within(dialog).getAllByRole("button", { name: "Close" })[0]!
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );

    const planarCount = account.relics.filter(
      (relic) => relic.slot === "planarSphere" || relic.slot === "linkRope"
    ).length;
    await user.click(screen.getByRole("button", { name: "Planar Ornaments" }));
    expect(await countCardsAcrossTabs(user)).toBe(planarCount);
    expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument();
  }, 30_000);

  it("updates triage thresholds from the rules popover and switches decision tabs", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderView(<TriageView />);

    await user.click(
      await screen.findByRole("button", { name: "Rules (40% / 20%)" })
    );
    const keepThreshold = await screen.findByRole("spinbutton", {
      name: "Keep at or above",
    });
    fireEvent.change(keepThreshold, { target: { value: "95" } });
    await waitFor(() =>
      expect(useWorkspaceStore.getState().triageRules.keepScoreAtLeast).toBe(95)
    );
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Rules (95% / 20%)" })
    ).toBeVisible();

    const salvage = screen.getByRole("tab", { name: /^Salvage review/ });
    await user.click(salvage);
    expect(salvage).toHaveAttribute("aria-selected", "true");
    expect(
      screen
        .queryAllByRole("article")
        .every(
          (card) =>
            card.getAttribute("data-triage-decision") === "salvage-review" ||
            card.parentElement?.closest("article")
        )
    ).toBe(true);
  });

  it("previews per-reason manager actionability without applying an unconnected task", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderView(<TriageView />);
    await user.click(
      await screen.findByRole("button", { name: "Apply to game" })
    );
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(metricValue(dialog, "Instructions")).toBeGreaterThan(0)
    );
    const instructionCount = metricValue(dialog, "Instructions");
    expect(metricValue(dialog, "Preview only")).toBe(instructionCount);
    expect(metricValue(dialog, "Actionable")).toBe(0);
    expect(metricValue(dialog, "Unknown prior state")).toBe(instructionCount);
    expect(metricValue(dialog, "Equipped pieces")).toBeGreaterThan(0);
    expect(metricValue(dialog, "Ambiguous matchers")).toBe(0);
    expect(
      within(dialog).getByRole("button", { name: "Apply to game" })
    ).toBeDisabled();
    expect(
      within(dialog).getByText(/reason counts may overlap/i)
    ).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Connect" })
    ).toBeEnabled();
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
    act(() => {
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
    });
    const user = userEvent.setup();
    renderView(<TriageView />);

    await user.click(
      await screen.findByRole("button", { name: "Rules (40% / 20%)" })
    );
    expect(
      await screen.findByRole("switch", { name: "Protect locked Relics" })
    ).toHaveAttribute("aria-checked", "false");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Apply to game" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(metricValue(dialog, "Locked before discard")).toBe(1)
    );
    expect(metricValue(dialog, "Preview only")).toBeGreaterThanOrEqual(1);
    expect(metricValue(dialog, "Blocked locked discards")).toBe(1);
    expect(
      within(dialog).getByText(/Locked pieces are never marked for discard/i)
    ).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Apply to game" })
    ).toBeDisabled();
  });
});
