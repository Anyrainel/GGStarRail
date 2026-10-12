import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import type { Relic } from "@/domain/game-account/schemas";
import { I18nProvider } from "@/i18n/I18nContext";
import InventoryView from "@/pages/game-account/InventoryView";
import {
  loadPropertyTables,
  loadRelicSets,
} from "@/providers/reference/catalog";
import { localizedName } from "@/services/catalog/presentation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "../../fixtures/demoAccount";

function renderInventory() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <InventoryView />
      </MemoryRouter>
    </I18nProvider>
  );
}

function relicTiles(section: HTMLElement) {
  return section.querySelectorAll("[data-relic-key]");
}

const MAX_RELIC_LEVEL = 15;
const CAVERN = new Set(["head", "hands", "body", "feet"]);

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("combined Account inventory", () => {
  it("keeps the account import empty state when no snapshot exists", () => {
    renderInventory();

    expect(
      screen.getByRole("heading", { name: "Inventory" })
    ).toBeInTheDocument();
    expect(screen.getByText("No account imported.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import account" })
    ).toBeInTheDocument();
  });

  it("keeps source coverage and all inventory groups in one collapsible flow", async () => {
    const account = await createDemoAccount(
      new Date("2026-09-02T12:00:00.000Z")
    );
    account.source.coverage = {
      characters: "complete",
      lightCones: "equipped-only",
      relics: "showcase-only",
    };
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderInventory();

    expect(
      screen.getByRole("region", { name: "Imported source coverage" })
    ).toHaveTextContent("does not represent a complete inventory");

    const characterSection = screen.getByRole("region", {
      name: "Characters",
    });
    const lightConeSection = screen.getByRole("region", {
      name: "Light Cones",
    });
    const relicSection = screen.getByRole("region", {
      name: "Relics",
    });

    const characterToggle = within(characterSection).getByRole("button", {
      name: "Characters (6)",
    });
    expect(characterToggle).toHaveAttribute("aria-expanded", "false");
    expect(
      within(lightConeSection).getByRole("button", {
        name: "Light Cones (6)",
      })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(relicSection).getByRole("button", {
        name: "Relics (20)",
      })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", { name: "Characters (6)" })
    ).toContainElement(characterToggle);

    await user.click(characterToggle);
    expect(
      await within(characterSection).findByRole("region", {
        name: "Inventory Character results",
      })
    ).toBeInTheDocument();
    // Spare gear is shown first; every demo Light Cone is equipped.
    expect(
      await within(lightConeSection).findByText("No items match these filters.")
    ).toBeInTheDocument();
    await user.click(
      within(lightConeSection).getByRole("button", { name: "Equipped" })
    );
    await within(lightConeSection).findByRole("region", {
      name: "Inventory Light Cone results",
    });
    await within(relicSection).findByRole("region", {
      name: "Inventory Relic results",
    });

    const characterIcon = characterSection.querySelector(
      "[data-item-icon-kind='character']"
    );
    const lightConeIcon = lightConeSection.querySelector(
      "[data-item-icon-kind='light-cone']"
    );
    const relicIcon = relicSection.querySelector(
      "[data-item-icon-kind='relic-piece']"
    );
    expect(characterIcon).toHaveAttribute("data-item-level");
    expect(characterIcon?.querySelector("[data-item-badge]")).not.toBeNull();
    expect(characterIcon).toHaveAttribute("tabindex", "0");
    expect(lightConeIcon).toHaveAttribute("data-item-level");
    expect(lightConeIcon?.querySelector("[data-item-badge]")).not.toBeNull();
    expect(relicIcon).toHaveAttribute("data-item-level");
    expect(relicIcon).toHaveAttribute("data-item-rarity");
    expect(relicIcon).toHaveAttribute("tabindex", "0");
    // No record counters or legends: chips and tiles only.
    expect(screen.queryByText(/\d+ records?/)).toBeNull();

    const syncButtons = screen.getAllByRole("button", {
      name: "Sync from Game",
    });
    expect(syncButtons).toHaveLength(3);
    await user.click(syncButtons[2]!);
    expect(
      await screen.findByRole("dialog", { name: "Import account data" })
    ).toBeVisible();
  });

  it("splits Relic tiles into Cavern and Planar groups and filters by slot and state", async () => {
    const account = await createDemoAccount();
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();
    const count = (predicate: (relic: Relic) => boolean) =>
      account.relics.filter(predicate).length;

    renderInventory();
    const relicSection = screen.getByRole("region", {
      name: "Relics",
    });
    await within(relicSection).findByRole("region", {
      name: "Inventory Relic results",
    });

    const unequipped = within(relicSection).getByRole("button", {
      name: "Unequipped",
    });
    const equipped = within(relicSection).getByRole("button", {
      name: "Equipped",
    });
    const maxLevel = within(relicSection).getByRole("button", {
      name: "Max level",
    });
    const enhanced = within(relicSection).getByRole("button", {
      name: "Enhanced",
    });
    expect(unequipped).toHaveAttribute("aria-pressed", "true");
    expect(equipped).toHaveAttribute("aria-pressed", "false");
    expect(maxLevel).toHaveAttribute("aria-pressed", "true");
    expect(enhanced).toHaveAttribute("aria-pressed", "false");

    const spareMax = (relic: Relic) =>
      !relic.equippedCharacterKey && relic.level === MAX_RELIC_LEVEL;
    expect(relicTiles(relicSection)).toHaveLength(count(spareMax));

    await user.click(equipped);
    const atMax = (relic: Relic) => relic.level === MAX_RELIC_LEVEL;
    await waitFor(() => {
      expect(relicTiles(relicSection)).toHaveLength(count(atMax));
    });
    const cavernGroup = relicSection.querySelector(
      "[data-relic-group='cavern']"
    );
    const planarGroup = relicSection.querySelector(
      "[data-relic-group='planar']"
    );
    expect(cavernGroup).toHaveTextContent(
      `Cavern Relics (${count((relic) => atMax(relic) && CAVERN.has(relic.slot))})`
    );
    expect(planarGroup).toHaveTextContent(
      `Planar Ornaments (${count((relic) => atMax(relic) && !CAVERN.has(relic.slot))})`
    );

    await user.click(
      within(relicSection).getByRole("button", { name: "Hands" })
    );
    await waitFor(() => {
      expect(relicTiles(relicSection)).toHaveLength(
        count((relic) => atMax(relic) && relic.slot === "hands")
      );
    });
    expect(
      relicSection.querySelector("[data-relic-group='planar']")
    ).toBeNull();

    // The Orbit chip adds both Planar Ornament slots at once.
    await user.click(
      within(relicSection).getByRole("button", { name: "Planar Ornaments" })
    );
    await user.click(enhanced);
    await waitFor(() => {
      expect(relicTiles(relicSection)).toHaveLength(
        count(
          (relic) =>
            relic.level > 0 &&
            (relic.slot === "hands" || !CAVERN.has(relic.slot))
        )
      );
    });
  });

  it("filters Relics by rarity, set, and discard status and clears back to everything", async () => {
    const [account, relicSets] = await Promise.all([
      createDemoAccount(),
      loadRelicSets(),
    ]);
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderInventory();
    const relicSection = screen.getByRole("region", {
      name: "Relics",
    });
    await within(relicSection).findByRole("region", {
      name: "Inventory Relic results",
    });
    for (const name of ["Equipped", "Enhanced", "+0"]) {
      await user.click(within(relicSection).getByRole("button", { name }));
    }
    expect(relicTiles(relicSection)).toHaveLength(account.relics.length);

    await user.click(within(relicSection).getByRole("button", { name: "5★" }));
    expect(
      await within(relicSection).findByText("No items match these filters.")
    ).toBeInTheDocument();
    await user.click(
      within(relicSection).getByRole("button", { name: "Clear all" })
    );
    await waitFor(() => {
      expect(relicTiles(relicSection)).toHaveLength(account.relics.length);
    });

    const setToggle = within(relicSection).getByRole("button", {
      name: "Filter by set",
    });
    expect(setToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(setToggle);
    expect(
      relicSection.querySelector("[data-relic-set-row='cavern']")
    ).not.toBeNull();
    expect(
      relicSection.querySelector("[data-relic-set-row='planar']")
    ).not.toBeNull();
    const firstSetId = account.relics[0]!.setId;
    const setName = localizedName(
      relicSets.byId.get(firstSetId)?.name,
      "en",
      firstSetId
    );
    await user.click(
      within(relicSection).getByRole("button", { name: setName })
    );
    await waitFor(() => {
      expect(relicTiles(relicSection)).toHaveLength(
        account.relics.filter((relic) => relic.setId === firstSetId).length
      );
    });
    // Collapsing keeps the chosen set visible.
    await user.click(setToggle);
    expect(
      within(relicSection).getByRole("button", { name: setName })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      within(relicSection).getByRole("button", { name: setName })
    );

    await user.click(
      within(relicSection).getByRole("button", { name: "Status" })
    );
    await user.click(
      within(relicSection).getByRole("button", { name: "Marked for discard" })
    );
    await waitFor(() => {
      expect(relicTiles(relicSection)).toHaveLength(
        account.relics.filter((relic) => relic.discarded === true).length
      );
    });
    const discardMarkers = within(relicSection).getAllByRole("img", {
      name: "Marked for discard",
    });
    expect(discardMarkers.length).toBeGreaterThan(0);
    expect(discardMarkers[0]).toHaveAttribute(
      "data-item-marker",
      "destructive"
    );
  });

  it("filters Characters by level and keeps Combat Types behind a toggle", async () => {
    const [account, properties] = await Promise.all([
      createDemoAccount(),
      loadPropertyTables(),
    ]);
    const lowLevel = account.characters[0]!;
    account.characters = account.characters.map((character) =>
      character.key === lowLevel.key ? { ...character, level: 50 } : character
    );
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderInventory();
    const section = screen.getByRole("region", { name: "Characters" });
    await user.click(
      within(section).getByRole("button", {
        name: `Characters (${account.characters.length})`,
      })
    );
    const results = await within(section).findByRole("region", {
      name: "Inventory Character results",
    });
    const tiles = () =>
      results.querySelectorAll("[data-item-icon-kind='character']");
    expect(
      within(section).getByRole("button", { name: "Max level" })
    ).toHaveAttribute("aria-pressed", "true");
    const otherLevels = within(section).getByRole("button", {
      name: "Other levels",
    });
    expect(otherLevels).toHaveAttribute("aria-pressed", "false");
    expect(tiles()).toHaveLength(account.characters.length - 1);
    await user.click(otherLevels);
    await waitFor(() => {
      expect(tiles()).toHaveLength(account.characters.length);
    });

    const combatTypeId = lowLevel.combatTypeId;
    const combatTypeName = localizedName(
      properties.combatTypeById.get(combatTypeId)?.name,
      "en",
      combatTypeId
    );
    const toggle = within(section).getByRole("button", {
      name: "Combat Type",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      within(section).queryByRole("button", { name: combatTypeName })
    ).toBeNull();
    await user.click(toggle);
    await user.click(
      within(section).getByRole("button", { name: combatTypeName })
    );
    await waitFor(() => {
      expect(tiles()).toHaveLength(
        account.characters.filter(
          (character) => character.combatTypeId === combatTypeId
        ).length
      );
    });
    // Collapsing keeps the chosen Combat Type visible.
    await user.click(toggle);
    expect(
      within(section).getByRole("button", { name: combatTypeName })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("groups identical Light Cones and filters them by Path", async () => {
    const [account, properties] = await Promise.all([
      createDemoAccount(),
      loadPropertyTables(),
    ]);
    const template = account.lightCones[0]!;
    account.lightCones = [
      ...account.lightCones,
      ...[1, 2].map((index) => ({
        ...template,
        key: `demo-light-cone:copy-${index}`,
        locked: false,
        equippedCharacterKey: undefined,
      })),
    ];
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderInventory();
    const section = screen.getByRole("region", { name: "Light Cones" });
    const results = await within(section).findByRole("region", {
      name: "Inventory Light Cone results",
    });
    // The two spare copies share one tile.
    expect(
      within(results).getAllByRole("img", { name: /2 copies$/ })
    ).toHaveLength(1);
    expect(within(results).getByText("x2")).toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: "Equipped" }));
    const pathId = account.lightCones[0]!.pathId;
    const pathName = localizedName(
      properties.pathById.get(pathId)?.name,
      "en",
      pathId
    );
    await user.click(within(section).getByRole("button", { name: pathName }));
    const onPath = account.lightCones.filter(
      (lightCone) => lightCone.pathId === pathId
    );
    await waitFor(() => {
      // Equipped cones are distinct; the two spare copies of the template share a tile.
      expect(
        results.querySelectorAll("[data-item-icon-kind='light-cone']")
      ).toHaveLength(onPath.length - (template.pathId === pathId ? 1 : 0));
    });
  });

  it("localizes the combined inventory and Relic controls in zh-CN", async () => {
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    useWorkspaceStore.getState().replaceAccount(await createDemoAccount());

    renderInventory();
    const relicSection = screen.getByRole("region", {
      name: "遗器",
    });
    await within(relicSection).findByRole("region", {
      name: "背包遗器结果",
    });

    expect(
      within(relicSection).getByRole("button", { name: "隧洞遗器" })
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(relicSection).getByRole("button", { name: "位面饰品" })
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(relicSection).getByRole("button", { name: "未装备" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(relicSection).getByRole("button", { name: "按套装筛选" })
    ).toBeInTheDocument();
    expect(
      within(relicSection).getByRole("button", { name: "状态" })
    ).toBeInTheDocument();
    expect(
      within(relicSection).getByRole("button", {
        name: "遗器 (20)",
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "从游戏同步" })).toHaveLength(
      3
    );
  });
});
