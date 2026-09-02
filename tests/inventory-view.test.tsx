import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { I18nProvider } from "@/i18n/I18nContext";
import { createDemoAccount } from "@/lib/demoAccount";
import InventoryView from "@/pages/account-data/InventoryView";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function renderInventory() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <InventoryView />
      </MemoryRouter>
    </I18nProvider>
  );
}

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("combined Account inventory", () => {
  it("keeps the account import empty state when no snapshot exists", () => {
    renderInventory();

    expect(
      screen.getByRole("heading", { name: "Inventory" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Import a validated account snapshot to browse Characters, Light Cones, Relics, and Planar Ornaments."
      )
    ).toBeInTheDocument();
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
      name: "Relics and Planar Ornaments",
    });

    expect(
      within(characterSection).getByRole("button", { name: /Characters 6/ })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(lightConeSection).getByRole("button", { name: /Light Cones 6/ })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(relicSection).getByRole("button", {
        name: /Relics and Planar Ornaments 20/,
      })
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(
      within(characterSection).getByRole("button", { name: /Characters 6/ })
    );
    expect(
      await within(characterSection).findByRole("region", {
        name: "Inventory Character results",
      })
    ).toBeInTheDocument();
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
    expect(lightConeIcon).toHaveAttribute("data-item-level");
    expect(lightConeIcon?.querySelector("[data-item-badge]")).not.toBeNull();
    expect(relicIcon).toHaveAttribute("data-item-level");
    expect(relicIcon).toHaveAttribute("data-item-rarity");
  });

  it("combines Cavern and Planar Relics with independent quick filters", async () => {
    const account = await createDemoAccount();
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderInventory();
    const relicSection = screen.getByRole("region", {
      name: "Relics and Planar Ornaments",
    });
    await within(relicSection).findByRole("region", {
      name: "Inventory Relic results",
    });

    expect(within(relicSection).getByText("20 records")).toBeInTheDocument();
    const cavern = within(relicSection).getByRole("button", {
      name: "Cavern Relics",
    });
    const planar = within(relicSection).getByRole("button", {
      name: "Planar Ornaments",
    });
    const equipped = within(relicSection).getByRole("button", {
      name: "Equipped",
    });
    const enhanced = within(relicSection).getByRole("button", {
      name: "Enhanced",
    });

    expect(cavern).toHaveAttribute("aria-pressed", "true");
    expect(planar).toHaveAttribute("aria-pressed", "true");
    await user.click(cavern);
    await user.click(equipped);
    await waitFor(() => {
      expect(within(relicSection).getByText("2 records")).toBeInTheDocument();
    });

    await user.click(enhanced);
    await waitFor(() => {
      expect(within(relicSection).getByText("1 record")).toBeInTheDocument();
    });
  });

  it("filters Relics by rarity, slot, set, and discard status", async () => {
    const account = await createDemoAccount();
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderInventory();
    const relicSection = screen.getByRole("region", {
      name: "Relics and Planar Ornaments",
    });
    await within(relicSection).findByRole("region", {
      name: "Inventory Relic results",
    });

    await user.click(
      within(relicSection).getByRole("button", { name: "5-star" })
    );
    expect(
      await within(relicSection).findByText("No items match these filters.")
    ).toBeInTheDocument();
    await user.click(
      within(relicSection).getByRole("button", { name: "5-star" })
    );

    const slotFilter = within(relicSection).getByRole("combobox", {
      name: "Slot",
    });
    await user.selectOptions(slotFilter, "hands");
    await waitFor(() => {
      expect(within(relicSection).getByText("4 records")).toBeInTheDocument();
    });
    await user.selectOptions(slotFilter, "all");

    const setFilter = within(relicSection).getByRole("combobox", {
      name: "Set",
    });
    const firstSet = within(setFilter)
      .getAllByRole("option")
      .find((option) => option.getAttribute("value") !== "all");
    if (!firstSet) throw new Error("Expected at least one demo Relic set");
    const firstSetId = firstSet.getAttribute("value");
    if (!firstSetId) throw new Error("Expected a stable Relic set ID");
    const expectedSetCount = account.relics.filter(
      (relic) => relic.setId === firstSetId
    ).length;
    await user.selectOptions(setFilter, firstSetId);
    await waitFor(() => {
      expect(
        within(relicSection).getByText(`${expectedSetCount} records`)
      ).toBeInTheDocument();
    });
    await user.selectOptions(setFilter, "all");

    const statusFilter = within(relicSection).getByRole("combobox", {
      name: "Status",
    });
    await user.selectOptions(statusFilter, "discarded");
    await waitFor(() => {
      expect(within(relicSection).getByText("1 record")).toBeInTheDocument();
    });
    expect(
      within(relicSection).getAllByText("Marked for discard").length
    ).toBeGreaterThan(1);
  });

  it("localizes the combined inventory and Relic controls in zh-CN", async () => {
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    useWorkspaceStore.getState().replaceAccount(await createDemoAccount());

    renderInventory();
    const relicSection = screen.getByRole("region", {
      name: "遗器与位面饰品",
    });
    await within(relicSection).findByRole("region", {
      name: "背包遗器结果",
    });

    expect(
      within(relicSection).getByRole("button", { name: "隧洞遗器" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(relicSection).getByRole("button", { name: "位面饰品" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(relicSection).getByRole("combobox", { name: "套装" })
    ).toBeInTheDocument();
    expect(
      within(relicSection).getByRole("combobox", { name: "状态" })
    ).toBeInTheDocument();
  });
});
