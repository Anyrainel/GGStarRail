import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { COMBAT_TYPE_RGB, TIER_COLORS } from "@/config/gameColors";
import { TierDocumentSchema } from "@/domain/tier-list/document";
import { I18nProvider } from "@/i18n/I18nContext";
import { combatTypeHeaderColor } from "@/lib/gameColors";
import CharacterTierListView from "@/pages/tier-list/CharacterTierListView";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useTierLibraryStore } from "@/stores/useTierLibraryStore";

function view() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <CharacterTierListView />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  act(() => {
    useCharacterPriorityStore.getState().resetPriorities();
    useTierLibraryStore.setState({ documents: {}, active: {} });
  });
});

describe("tier list controls", () => {
  it("preserves current rankings while creating, switching, and hydrating named lists", async () => {
    const user = userEvent.setup();
    const rendered = view();
    const customize = await screen.findByRole(
      "button",
      { name: "Customize" },
      { timeout: 15000 }
    );
    await user.click(customize);
    await user.type(screen.getByLabelText("Title"), "Favorites");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })
    );
    const item = rendered.container.querySelector<HTMLElement>(
      "[data-priority-item-id]"
    );
    if (!item?.dataset.priorityItemId) throw new Error("Missing tier item");
    const id = item.dataset.priorityItemId;
    await user.click(item);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "S",
      })
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })
    );
    await user.click(screen.getByRole("button", { name: "Manage lists" }));
    await user.click(screen.getByRole("button", { name: "New tier list" }));
    expect(useCharacterPriorityStore.getState().assignments).toEqual({});
    await user.click(screen.getByRole("button", { name: "Manage lists" }));
    await user.click(screen.getByRole("button", { name: "Favorites" }));
    expect(useCharacterPriorityStore.getState().assignments[id]?.tier).toBe(
      "S"
    );
    rendered.unmount();
    await act(() => useTierLibraryStore.persist.rehydrate());
    await act(() => useCharacterPriorityStore.persist.rehydrate());
    view();
    expect(await screen.findByText("Favorites")).toBeVisible();
    expect(useCharacterPriorityStore.getState().assignments[id]?.tier).toBe(
      "S"
    );
  });

  it("filters without removing saved rankings, and opens details from keyboard focus", async () => {
    const user = userEvent.setup();
    const rendered = view();
    await screen.findByRole(
      "button",
      { name: "Customize" },
      { timeout: 15000 }
    );
    const item = rendered.container.querySelector<HTMLElement>(
      "[data-priority-item-id]"
    );
    if (!item?.dataset.priorityItemId) throw new Error("Missing tier item");
    const id = item.dataset.priorityItemId;
    act(() =>
      useCharacterPriorityStore
        .getState()
        .setPriorityState({ assignments: { [id]: { tier: "A", position: 0 } } })
    );
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "5★" }));
    await user.click(dialog.getByRole("button", { name: "Close" }));
    expect(
      rendered.container.querySelector(`[data-priority-item-id="${id}"]`)
    ).toBeNull();
    expect(useCharacterPriorityStore.getState().assignments[id]?.tier).toBe(
      "A"
    );
    rendered.unmount();
    render(
      <I18nProvider>
        <CatalogHoverCard kind="character" id={id}>
          <button type="button">Details</button>
        </CatalogHoverCard>
      </I18nProvider>
    );
    await user.tab();
    await waitFor(() => expect(screen.getByText("Level 80")).toBeVisible(), {
      timeout: 15000,
    });
    expect(screen.getByText("HP")).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Level 80")).toBeNull());
  });
});

it("uses the supplied element palette and preserves the Genshin tier palette", () => {
  expect(COMBAT_TYPE_RGB).toEqual({
    Physical: [255, 255, 255],
    Fire: [248, 78, 54],
    Ice: [71, 199, 253],
    Thunder: [223, 83, 255],
    Wind: [70, 222, 156],
    Quantum: [135, 128, 255],
    Imaginary: [255, 235, 97],
  });
  expect(Object.values(TIER_COLORS).map((color) => color.header)).toEqual([
    "#b92f3a",
    "#dd8559",
    "#e6b44d",
    "#43ad8b",
    "#4a85cd",
    "#757575",
  ]);
  for (const [id, rgb] of Object.entries(COMBAT_TYPE_RGB)) {
    const header = combatTypeHeaderColor(id)?.match(/\d+/g)?.map(Number) ?? [];
    expect(header).toHaveLength(3);
    expect(Math.max(...header)).toBeLessThan(Math.max(...rgb));
    if (id !== "Physical")
      expect(Math.max(...header) - Math.min(...header)).toBeLessThan(
        Math.max(...rgb) - Math.min(...rgb)
      );
  }
});

it("rejects foreign, future, and invalid tier documents", () => {
  const valid = {
    kind: "ggstarrail.tier-list",
    schemaVersion: 1,
    category: "character",
    assignments: { "1001": { tier: "S", position: 0 } },
    groupAssignments: {},
    presentation: { title: "", labels: {}, hidden: [] },
  };
  expect(TierDocumentSchema.safeParse(valid).success).toBe(true);
  expect(
    TierDocumentSchema.safeParse({ ...valid, kind: "genshin.tier-list" })
      .success
  ).toBe(false);
  expect(
    TierDocumentSchema.safeParse({ ...valid, schemaVersion: 2 }).success
  ).toBe(false);
  expect(
    TierDocumentSchema.safeParse({
      ...valid,
      assignments: { "1001": { tier: "SS", position: -1 } },
    }).success
  ).toBe(false);
});
