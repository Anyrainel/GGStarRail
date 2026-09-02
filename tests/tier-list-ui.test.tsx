import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n/I18nContext";
import CharacterTierListView from "@/pages/tier-list/CharacterTierListView";
import LightConeTierListView from "@/pages/tier-list/LightConeTierListView";
import RelicTierListView from "@/pages/tier-list/RelicTierListView";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useLightConePriorityStore } from "@/stores/useLightConePriorityStore";
import { useRelicPriorityStore } from "@/stores/useRelicPriorityStore";

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
    const user = userEvent.setup();
    const { container } = renderView(<CharacterTierListView />);

    expect(
      await screen.findByRole("heading", { name: "Character Priority" })
    ).toBeVisible();
    expect(
      await screen.findByText("0 ranked · 93 in Pool", {}, catalogTimeout)
    ).toBeVisible();
    await waitFor(
      () => expect(priorityItems(container).length).toBeGreaterThan(0),
      catalogTimeout
    );

    const firstItem = priorityItems(container)[0];
    if (!firstItem) throw new Error("Character priority item missing");
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
    expect(screen.getByText("1 ranked · 92 in Pool")).toBeVisible();
  });

  it("groups Light Cones by Path while leaving every entry unranked", async () => {
    const { container } = renderView(<LightConeTierListView />);

    expect(
      await screen.findByText("0 ranked · 169 in Pool", {}, catalogTimeout)
    ).toBeVisible();
    await waitFor(
      () => expect(priorityItems(container).length).toBeGreaterThan(0),
      catalogTimeout
    );
    expect(screen.getAllByRole("tab").length).toBeGreaterThan(1);
    expect(useLightConePriorityStore.getState().assignments).toEqual({});
  });

  it("keeps Relics and Planar Ornaments together with player-owned role columns", async () => {
    const user = userEvent.setup();
    const { container } = renderView(<RelicTierListView />);

    expect(
      await screen.findByText("0 ranked · 60 in Pool", {}, catalogTimeout)
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Cavern Relic" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Planar Ornament" })
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Other" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await waitFor(
      () => expect(priorityItems(container).length).toBe(60),
      catalogTimeout
    );

    const firstItem = priorityItems(container)[0];
    if (!firstItem) throw new Error("Relic priority item missing");
    const itemId = firstItem.dataset.priorityItemId;
    if (!itemId) throw new Error("Relic priority ID missing");
    await user.click(firstItem);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "A" }));
    await user.click(within(dialog).getByRole("button", { name: "DPS" }));

    await waitFor(() => {
      expect(useRelicPriorityStore.getState().assignments[itemId]).toEqual({
        tier: "A",
        position: 0,
      });
      expect(useRelicPriorityStore.getState().groupAssignments[itemId]).toBe(
        "dps"
      );
    });

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Planar Ornament" }));
    const planarItems = container.querySelectorAll("[data-priority-item-id]");
    expect(planarItems.length).toBeGreaterThan(0);
    expect(planarItems.length).toBeLessThan(60);
  });

  it("renders the priority contract and Relic categories in zh-CN", async () => {
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    renderView(<RelicTierListView />);

    expect(
      await screen.findByRole("heading", { name: "遗器优先级" }, catalogTimeout)
    ).toBeVisible();
    expect(screen.getByText("这是你的个人优先级列表")).toBeVisible();
    expect(screen.getByRole("button", { name: "隧洞遗器" })).toBeVisible();
    expect(screen.getByRole("button", { name: "位面饰品" })).toBeVisible();
  });
});
