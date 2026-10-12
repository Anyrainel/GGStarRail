import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { TierCatalogState } from "@/components/tier-list/TierCatalogState";
import { STORAGE_KEYS } from "@/config/identity";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n/I18nContext";
import CharacterTierListView from "@/pages/tier-list/CharacterTierListView";
import LightConeTierListView from "@/pages/tier-list/LightConeTierListView";
import RelicTierListView from "@/pages/tier-list/RelicTierListView";
import { loadCharacters, loadLightCones } from "@/providers/reference/catalog";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useLightConePriorityStore } from "@/stores/useLightConePriorityStore";
import { useRelicPriorityStore } from "@/stores/useRelicPriorityStore";
import { useTierLibraryStore } from "@/stores/useTierLibraryStore";

const catalogTimeout = { timeout: 15_000 };

function renderView(view: React.ReactNode) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter>{view}</MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

function priorityItems(container: HTMLElement) {
  return container.querySelectorAll<HTMLElement>("[data-priority-item-id]");
}

describe("HSR Tier List views", () => {
  beforeEach(() => {
    act(() => {
      useCharacterPriorityStore.getState().resetPriorities();
      useLightConePriorityStore.getState().resetPriorities();
      useRelicPriorityStore.getState().resetPriorities();
    });
  });

  it("starts the complete Character catalog in Pool and saves a tapped tier", async () => {
    const total = (await loadCharacters()).identities.length;
    const user = userEvent.setup();
    const { container } = renderView(<CharacterTierListView />);

    expect(
      await screen.findByText(`0 ranked · ${total} in Pool`, {}, catalogTimeout)
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Character Priority" })
    ).toBeVisible();
    await waitFor(
      () => expect(priorityItems(container).length).toBeGreaterThan(0),
      catalogTimeout
    );

    const firstItem = priorityItems(container)[0];
    if (!firstItem) throw new Error("Character priority item missing");
    expect(
      firstItem.querySelector('[data-item-icon-kind="character"]')
    ).toHaveAttribute("data-item-rarity", "5");
    const itemId = firstItem.dataset.priorityItemId;
    if (!itemId) throw new Error("Character priority ID missing");
    await user.click(firstItem);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "S" }));

    await waitFor(() => {
      expect(useCharacterPriorityStore.getState().assignments[itemId]).toEqual({
        tier: "S",
        position: 0,
      });
    });
    expect(screen.getByText(`1 ranked · ${total - 1} in Pool`)).toBeVisible();
  });

  it("groups Light Cones by Path while leaving every entry unranked", async () => {
    const total = (await loadLightCones()).values.length;
    const { container } = renderView(<LightConeTierListView />);

    expect(
      await screen.findByText(`0 ranked · ${total} in Pool`, {}, catalogTimeout)
    ).toBeVisible();
    await waitFor(
      () => expect(priorityItems(container).length).toBeGreaterThan(0),
      catalogTimeout
    );
    expect(
      priorityItems(container)[0]?.querySelector(
        '[data-item-icon-kind="light-cone"]'
      )
    ).toHaveAttribute("data-item-rarity", "5");
    expect(screen.getAllByRole("tab").length).toBeGreaterThan(1);
    expect(useLightConePriorityStore.getState().assignments).toEqual({});
  });

  it("groups Relics by kind and preserves ranks independently of legacy roles", async () => {
    const user = userEvent.setup();
    const { container } = renderView(<RelicTierListView />);

    expect(
      await screen.findByText("0 ranked · 62 in Pool", {}, catalogTimeout)
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Cavern Relic" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await waitFor(
      () => expect(priorityItems(container).length).toBeGreaterThan(0),
      catalogTimeout
    );
    expect(
      [...priorityItems(container)].every(
        (item) =>
          item
            .querySelector('[data-item-icon-kind="relic-set"]')
            ?.getAttribute("data-item-rarity") !== "unknown"
      )
    ).toBe(true);

    const firstItem = priorityItems(container)[0];
    if (!firstItem) throw new Error("Relic priority item missing");
    const itemId = firstItem.dataset.priorityItemId;
    if (!itemId) throw new Error("Relic priority ID missing");
    act(() => {
      useRelicPriorityStore.getState().setPriorityState({
        assignments: { [itemId]: { tier: "B", position: 0 } },
        groupAssignments: { [itemId]: "support" },
      });
    });
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: "Support" })).toBeNull();
    await user.click(
      container.querySelector<HTMLElement>(
        `[data-priority-item-id="${itemId}"]`
      )!
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "DPS" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "A" }));

    await waitFor(() => {
      expect(useRelicPriorityStore.getState().assignments[itemId]).toEqual({
        tier: "A",
        position: 0,
      });
    });

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    const cavernIds = new Set(
      [...priorityItems(container)].map((item) => item.dataset.priorityItemId)
    );
    await user.click(screen.getByRole("tab", { name: "Planar Ornament" }));
    expect(
      [...priorityItems(container)].every(
        (item) => !cavernIds.has(item.dataset.priorityItemId)
      )
    ).toBe(true);
    const planarItems = container.querySelectorAll("[data-priority-item-id]");
    expect(planarItems.length).toBeGreaterThan(0);
    expect(planarItems.length).toBeLessThan(62);

    // The kind chips narrow the grid to one group and keep every rank.
    const [cavernChip] = screen.getAllByRole("button", {
      name: "Cavern Relic",
    });
    if (!cavernChip) throw new Error("Cavern Relic filter missing");
    await user.click(cavernChip);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Cavern Relic" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(useRelicPriorityStore.getState().assignments[itemId]?.tier).toBe(
      "A"
    );
    await user.click(cavernChip);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "5★" })).toBeNull();
  });

  it.each([
    ["loading", true, "status"],
    ["unavailable", false, "alert"],
  ] as const)(
    "keeps the title row while the catalog is %s",
    (_state, loading, role) => {
      renderView(
        <TierCatalogState
          category="light-cone"
          loading={loading}
          error={loading ? null : new Error("offline")}
        />
      );
      const heading = screen.getByRole("heading", {
        level: 1,
        name: "Light Cone Priority",
      });
      expect(heading.closest(".sr-only")).toBeNull();
      expect(screen.getByRole("button", { name: "Customize" })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Manage lists" })
      ).toBeDisabled();
      expect(
        screen.getByRole(role).closest("[data-wide-content]")
      ).not.toBeNull();
    }
  );

  it("titles the catalog state with the active list's saved name", () => {
    act(() => {
      const library = useTierLibraryStore.getState();
      library.save("speed", {
        kind: "ggstarrail.tier-list",
        schemaVersion: 2,
        category: "character",
        assignments: {},
        groupAssignments: {},
        presentation: { title: "Speed team", labels: {}, hidden: [] },
      });
      library.activate("character", "speed");
    });
    try {
      renderView(
        <TierCatalogState category="character" loading error={null} />
      );
      expect(
        screen.getByRole("heading", { level: 1, name: "Speed team" })
      ).toBeInTheDocument();
    } finally {
      act(() => useTierLibraryStore.getState().remove("speed"));
    }
  });

  it("renders the priority controls and Relic categories in zh-CN", async () => {
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    renderView(<RelicTierListView />);

    expect(
      await screen.findByRole("tab", { name: "隧洞遗器" }, catalogTimeout)
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "遗器优先级" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "位面饰品" })).toBeVisible();
  });
});
