import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_PATHS } from "@/config/navigation";
import { abilityTraceId } from "@/domain/account/traces";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { eidolonLevelBonuses } from "@/domain/combat/kit/skillLevels";
import { I18nProvider } from "@/i18n/I18nContext";
import { messagesEn } from "@/i18n/messages.en";
import { loadBuildReferences } from "@/lib/buildReferences";
import {
  characterCatalogName,
  formatAccountStatValue,
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { equippedSetSummary, shortStatKey } from "@/lib/relicPresentation";
import CharacterView from "@/pages/account-data/CharacterView";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "./fixtures/demoAccount";

function mockMedia(matches: (query: string) => boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function sortButton(
  panel: ReturnType<typeof within>,
  field: string,
  direction: "Ascending" | "Descending" | "No sorting"
) {
  return within(panel.getByRole("group", { name: field })).getByRole("button", {
    name: direction,
  });
}

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
  act(() => {
    useWorkspaceStore.getState().clearWorkspace();
    useCharacterPriorityStore.getState().resetPriorities();
  });
});

describe("Account Character loadouts", () => {
  it("starts with account import and offers no demo account", () => {
    renderView();
    expect(
      screen.getByRole("button", { name: "Import account" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /demo/i })
    ).not.toBeInTheDocument();
    expect(useWorkspaceStore.getState().account).toBeNull();
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
    const planar = createCharacterBuild(
      definition,
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
      "Account planar build",
      "build:account-planar"
    );
    workspace.replaceAccount(account);
    workspace.replaceBuildWorkspace({
      builds: [cardBuild, planar],
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
    const cavernSets = within(card).getByRole("list", {
      name: "Cavern Relic sets",
    });
    const planarSets = within(card).getByRole("list", {
      name: "Planar Ornament sets",
    });
    const equipped = account.relics.filter(
      (relic) => relic.equippedCharacterKey === ownedCharacter.key
    );
    const summary = equippedSetSummary(equipped);
    const cavernChips = cavernSets.querySelectorAll("[data-set-bonus]");
    expect(cavernChips).toHaveLength(summary.cavern.length);
    summary.cavern.forEach((bonus, index) => {
      // The chip names the active bonus tier, not the raw piece count.
      expect(cavernChips[index]).toHaveAttribute(
        "data-set-bonus",
        String(bonus.tier)
      );
      expect(cavernChips[index]).toHaveTextContent(`${bonus.tier}-pc`);
    });
    expect(planarSets.querySelectorAll("[data-set-bonus='2']")).toHaveLength(
      summary.planar ? 1 : 0
    );

    const grid = card.querySelector("[data-relic-slot-grid]");
    expect(grid).toHaveAttribute("data-relic-slot-grid", "row");
    expect(
      within(card).getByRole("region", { name: "Equipped Relics" })
    ).toContainElement(grid as HTMLElement);
    expect(card.querySelectorAll("[data-relic-slot]")).toHaveLength(6);
    expect(
      [
        ...card.querySelectorAll("[data-relic-slot][data-relic-kind='cavern']"),
      ].map((cell) => cell.getAttribute("data-relic-slot"))
    ).toEqual(["head", "hands", "body", "feet"]);
    expect(
      [
        ...card.querySelectorAll("[data-relic-slot][data-relic-kind='planar']"),
      ].map((cell) => cell.getAttribute("data-relic-slot"))
    ).toEqual(["planarSphere", "linkRope"]);
    expect(card.querySelector("[data-relic-divider]")).not.toBeNull();
    // Sets sit over their own groups: Cavern over four slots, Planar over two.
    expect(
      card.querySelector("[data-relic-group-header='cavern']")
    ).toContainElement(cavernSets);
    expect(
      card.querySelector("[data-relic-group-header='planar']")
    ).toContainElement(planarSets);
    expect(card.querySelectorAll("[data-relic-score]")).toHaveLength(6);
    expect(card.querySelector("[data-aggregate-score]")).toBeVisible();
    expect(
      within(card).getByText(
        "Scored against Account card build + Account planar build"
      )
    ).toBeInTheDocument();
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
      `[data-relic-column='${firstRelic.slot}']`
    );
    if (!(relicColumn instanceof HTMLElement)) {
      throw new Error("Relic stat column missing");
    }
    const mainStatRow = relicColumn.querySelector("[data-main-stat-row]");
    expect(mainStatRow).toHaveTextContent(`+${firstRelic.level}`);
    expect(mainStatRow).not.toContainElement(
      relicColumn.querySelector("[data-relic-markers]") as HTMLElement | null
    );
    for (const substat of firstRelic.substats) {
      const key = shortStatKey(substat.statId);
      const row = relicColumn.querySelector(
        `[data-relic-substat='${substat.statId}']`
      );
      expect(row).toHaveTextContent(
        key
          ? messagesEn[key]
          : localizedPropertyName(substat.statId, references.properties, "en")
      );
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

    const offTargetColumn = card.querySelector("[data-relic-column='body']");
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
      expect(slot.querySelector("[data-relic-empty]")).toHaveTextContent(
        "Empty slot"
      );
    }
    expect(
      within(emptyCard).getByRole("list", { name: "Cavern Relic sets" })
    ).toHaveTextContent("No set bonus");
  });

  it("filters the roster and restores it with the compact filter panel", async () => {
    useWorkspaceStore.getState().replaceAccount(await createDemoAccount());
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    const filterDialog = screen.getByRole("dialog", { name: "Filters" });
    expect(
      within(filterDialog).getByRole("complementary", {
        name: "Character filters",
      })
    ).toBeVisible();
    const search = within(filterDialog).getByRole("searchbox", {
      name: "Search",
    });
    await user.type(search, "no-such-character");
    expect(
      await screen.findByText("No items match these filters.")
    ).toBeVisible();

    const clear = within(filterDialog).getByRole("button", {
      name: "Clear all",
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

  it("combines multiple Combat Types with rarity and sorts real account levels", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(),
      loadBuildReferences(),
    ]);
    account.characters = account.characters.map((character, index) => ({
      ...character,
      level: 10 + index,
    }));
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();
    renderView();
    await screen.findAllByRole("article", { name: / loadout$/ });
    const panel = within(
      screen.getByRole("complementary", { name: "Character filters" })
    );
    expect(sortButton(panel, "Release Date", "Descending")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(sortButton(panel, "Level", "No sorting")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(panel.queryByRole("group", { name: "Name" })).toBeNull();
    expect(sortButton(panel, "Priority", "Descending")).toBeDisabled();
    expect(panel.getByRole("group", { name: "Priority" })).toHaveAttribute(
      "title",
      "Assign Characters in Character Priority to sort by priority."
    );
    // The result count is announced, not shown.
    expect(panel.getByText(/\d+ records?/)).toHaveClass("sr-only");
    const prioritized = account.characters.at(-1)!;
    act(() =>
      useCharacterPriorityStore.getState().setPriorityState({
        assignments: {
          [prioritized.definitionId]: { tier: "S", position: 0 },
        },
      })
    );
    await user.click(sortButton(panel, "Priority", "Descending"));
    expect(
      screen.getAllByRole("article", { name: / loadout$/ })[0]
    ).toHaveAccessibleName(
      `${characterCatalogName(references.characters.byId.get(prioritized.definitionId)!, "en", "Trailblazer")} loadout`
    );
    const selectedTypes = [
      ...new Set(account.characters.map((character) => character.combatTypeId)),
    ].slice(0, 2);
    for (const id of selectedTypes) {
      const name = localizedName(
        references.properties.combatTypeById.get(id)?.name,
        "en",
        id
      );
      if (!name) throw new Error("Combat Type name missing");
      await user.click(panel.getByRole("checkbox", { name }));
    }
    const matchingTypes = account.characters.filter((character) =>
      selectedTypes.includes(character.combatTypeId)
    );
    expect(screen.getAllByRole("article", { name: / loadout$/ })).toHaveLength(
      matchingTypes.length
    );
    const rarity = references.characters.byId.get(
      matchingTypes[0].definitionId
    )!.rarity;
    await user.click(panel.getByRole("checkbox", { name: `★ ${rarity}` }));
    const matching = matchingTypes.filter(
      (character) =>
        references.characters.byId.get(character.definitionId)?.rarity ===
        rarity
    );
    expect(screen.getAllByRole("article", { name: / loadout$/ })).toHaveLength(
      matching.length
    );
    await user.click(sortButton(panel, "Level", "Ascending"));
    expect(sortButton(panel, "Release Date", "No sorting")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const first = [...matching].sort(
      (left, right) => left.level - right.level
    )[0];
    const definition = references.characters.byId.get(first.definitionId);
    if (!definition) throw new Error("Character name missing");
    expect(
      screen.getAllByRole("article", { name: / loadout$/ })[0]
    ).toHaveAccessibleName(
      `${characterCatalogName(definition, "en", "Trailblazer")} loadout`
    );
    await user.click(panel.getByRole("button", { name: "Clear all" }));
    expect(screen.getAllByRole("article", { name: / loadout$/ })).toHaveLength(
      account.characters.length
    );
    // Turning the active sort off returns to the release order.
    await user.click(sortButton(panel, "Level", "No sorting"));
    expect(sortButton(panel, "Release Date", "Descending")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("compacts the Relic columns at the initial two-column breakpoint and restores full density at 2048px", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(),
      loadBuildReferences(),
    ]);
    useWorkspaceStore.getState().replaceAccount(account);
    const definition = references.characters.byId.get(
      account.characters[0]!.definitionId
    );
    if (!definition) throw new Error("Character reference missing");
    const cardName = `${characterCatalogName(definition, "en", "Trailblazer")} loadout`;
    mockMedia((query) => query.includes("min-width: 1536px"));

    const compactRender = renderView();
    const compactCard = await screen.findByRole("article", { name: cardName });
    // Like GGArtifact, the header keeps its size; only the Relic columns compact.
    expect(
      compactCard.querySelector("[data-item-icon-kind='character']")
    ).toHaveStyle({ width: "64px" });
    expect(
      compactCard.querySelector("[data-item-icon-kind='relic-set']")
    ).toHaveStyle({ width: "48px" });
    expect(compactCard.querySelector("[data-relic-column]")).toHaveClass("p-1");
    expect(compactCard.querySelector("[data-relic-slot-grid]")).toHaveAttribute(
      "data-relic-slot-grid",
      "row"
    );
    compactRender.unmount();

    mockMedia(() => false);
    renderView();
    const fullCard = await screen.findByRole("article", { name: cardName });
    expect(
      fullCard.querySelector("[data-item-icon-kind='character']")
    ).toHaveStyle({ width: "64px" });
    expect(fullCard.querySelector("[data-relic-column]")).toHaveClass("p-2");
  });

  it("compacts the 4 + 2 row's stats while the card is narrower than 680px", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(),
      loadBuildReferences(),
    ]);
    useWorkspaceStore.getState().replaceAccount(account);
    const definition = references.characters.byId.get(
      account.characters[0]!.definitionId
    );
    if (!definition) throw new Error("Character reference missing");
    mockMedia(
      (query) =>
        query.includes("max-width: 679px") || query.includes("max-width: 767px")
    );

    renderView();
    const card = await screen.findByRole("article", {
      name: `${characterCatalogName(definition, "en", "Trailblazer")} loadout`,
    });
    expect(card.querySelector("[data-relic-slot-grid]")).toHaveAttribute(
      "data-relic-slot-grid",
      "row"
    );
    expect(card.querySelector("[data-relic-column]")).toHaveClass("p-1");
  });

  it("opens catalog details from the portrait, Light Cone, and set chips", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(),
      loadBuildReferences(),
    ]);
    useWorkspaceStore.getState().replaceAccount(account);
    const character = account.characters.find(
      (entry) => entry.lightConeKey && entry.relicKeys.length > 0
    );
    if (!character) throw new Error("Expected an equipped demo Character");
    const definition = references.characters.byId.get(character.definitionId);
    const lightCone = account.lightCones.find(
      (entry) => entry.key === character.lightConeKey
    );
    const lightConeDefinition = lightCone
      ? references.lightCones.byId.get(lightCone.definitionId)
      : undefined;
    if (!definition || !lightConeDefinition) {
      throw new Error("Catalog references missing");
    }
    const relics = account.relics.filter((relic) =>
      character.relicKeys.includes(relic.key)
    );
    const firstSet = [
      ...equippedSetSummary(relics).cavern,
      equippedSetSummary(relics).planar,
    ].find(Boolean);
    if (!firstSet) throw new Error("Expected an equipped set bonus");
    const characterName = characterCatalogName(definition, "en", "Trailblazer");

    renderView();
    const card = await screen.findByRole("article", {
      name: `${characterName} loadout`,
    });
    const details = (name: string) =>
      screen.findByRole("article", { name }, { timeout: 3000 });

    const portrait = within(card).getByRole("link", {
      name: `Open ${characterName} in the Character Archive`,
    });
    act(() => portrait.focus());
    expect(await details(characterName)).toBeInTheDocument();
    act(() => portrait.blur());

    const lightConeIcon = card.querySelector(
      "[data-item-icon-kind='light-cone']"
    );
    if (!(lightConeIcon instanceof HTMLElement)) {
      throw new Error("Light Cone icon missing");
    }
    expect(lightConeIcon).toHaveAttribute("tabindex", "0");
    act(() => lightConeIcon.focus());
    const lightConeName = localizedName(
      lightConeDefinition.name,
      "en",
      lightConeDefinition.id
    );
    expect(await details(lightConeName)).toBeInTheDocument();
    act(() => lightConeIcon.blur());

    // Chips follow the summary order: Cavern sets, then the Planar set.
    const setIcon = card.querySelector(
      "[data-set-bonus] [data-item-icon-kind='relic-set']"
    );
    if (!(setIcon instanceof HTMLElement)) throw new Error("Set chip missing");
    act(() => setIcon.focus());
    const setName = localizedName(
      references.relicSets.byId.get(firstSet.setId)?.name,
      "en",
      firstSet.setId
    );
    const setDetails = await details(setName);
    expect(setDetails).toHaveTextContent("2-Piece");
  });

  it("stacks four Cavern slots over two Planar slots at 560px and below", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(),
      loadBuildReferences(),
    ]);
    useWorkspaceStore.getState().replaceAccount(account);
    const character = account.characters[0]!;
    const definition = references.characters.byId.get(character.definitionId);
    if (!definition) throw new Error("Character reference missing");
    mockMedia(
      (query) =>
        query.includes("max-width: 560px") || query.includes("max-width: 767px")
    );

    renderView();
    const card = await screen.findByRole("article", {
      name: `${characterCatalogName(definition, "en", "Trailblazer")} loadout`,
    });
    const grid = card.querySelector("[data-relic-slot-grid]");
    expect(grid).toHaveAttribute("data-relic-slot-grid", "stacked");
    expect(grid).toHaveClass("grid-cols-4");
    expect(card.querySelector("[data-item-icon-kind='character']")).toHaveStyle(
      { width: "56px" }
    );
    expect(card.querySelector("[data-relic-column]")).toHaveClass("p-1");
    // The Planar set and the score share the spare cells beside the Planar slots.
    const planarCell = card.querySelector("[data-relic-group-header='planar']");
    if (!(planarCell instanceof HTMLElement)) {
      throw new Error("Planar cell missing");
    }
    expect(planarCell.querySelector("[data-score-block]")).not.toBeNull();
    const planarChip = planarCell.querySelector("[data-set-bonus]");
    if (planarChip) {
      expect(planarChip.querySelector("[data-item-badge='2']")).not.toBeNull();
    }
  });

  it("shows reported Trace levels with Eidolon bonuses next to the name", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(),
      loadBuildReferences(),
    ]);
    const traced = account.characters.find(
      (character) => character.eidolon >= 3
    );
    if (!traced) throw new Error("Demo Character at E3 or above missing");
    const definition = references.characters.byId.get(traced.definitionId);
    if (!definition) throw new Error("Character reference missing");
    const levels = { basic: 6, skill: 10, ultimate: 9, talent: 10 } as const;
    account.characters = account.characters.map((character) =>
      character.key === traced.key
        ? {
            ...character,
            traces: Object.fromEntries(
              Object.entries(levels).map(([kind, level]) => [
                abilityTraceId(definition.id, kind as keyof typeof levels),
                level,
              ])
            ),
          }
        : character
    );
    useWorkspaceStore.getState().replaceAccount(account);

    renderView();
    const card = await screen.findByRole("article", {
      name: `${characterCatalogName(definition, "en", "Trailblazer")} loadout`,
    });
    const bonuses = eidolonLevelBonuses(definition, traced.eidolon);
    expect(Object.values(bonuses).some((bonus) => bonus > 0)).toBe(true);
    const labels = {
      basic: "Basic",
      skill: "Skill",
      ultimate: "Ult",
      talent: "Talent",
    } as const;
    for (const [kind, level] of Object.entries(levels) as [
      keyof typeof levels,
      number,
    ][]) {
      const bonus = bonuses[kind];
      expect(card.querySelector(`[data-trace='${kind}']`)).toHaveTextContent(
        `${labels[kind]} ${level}${bonus > 0 ? `+${bonus}` : ""}`
      );
    }
    expect(card.querySelector("[data-trace='memospriteSkill']")).toBeNull();
    const untraced = screen
      .getAllByRole("article", { name: / loadout$/ })
      .find((article) => article !== card);
    expect(untraced?.querySelector("[data-trace-levels]")).toBeNull();
  });
});
