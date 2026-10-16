import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterLightCones } from "@/components/builds/CharacterLightCones";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import {
  catalogPickerItems,
  rarityPickerFilter,
} from "@/services/catalog/pickerItems";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

afterEach(() => act(() => useWorkspaceStore.getState().clearWorkspace()));

describe("shared catalog picker", () => {
  it("cancels pending hover timers when focus and pointer events precede unmount", () => {
    const view = render(
      <I18nProvider>
        <CatalogHoverCard kind="character" id="1001" disabled>
          <button type="button">Hover target</button>
        </CatalogHoverCard>
      </I18nProvider>
    );
    const target = screen.getByRole("button", { name: "Hover target" });
    fireEvent.pointerEnter(target, { pointerType: "mouse" });
    fireEvent.focus(target);
    fireEvent.blur(target);
    fireEvent.pointerLeave(target, { pointerType: "mouse" });
    view.unmount();
    // The global teardown guard proves that no delayed callback survives.
  });
  it.each(["character", "light-cone", "relic-set"] as const)(
    "searches and selects %s with the same controls",
    async (kind) => {
      const references = await loadBuildReferences();
      const items = catalogPickerItems(kind, references, "en", "Trailblazer");
      const chosen = items[0]!;
      const onChange = vi.fn();
      const user = userEvent.setup();
      const view = render(
        <I18nProvider>
          <ItemPicker
            kind={kind}
            items={items}
            value={null}
            label="Choose"
            onChange={onChange}
            filters={[rarityPickerFilter(items, "Rarity")]}
          />
        </I18nProvider>
      );
      await user.click(screen.getByRole("button", { name: "Choose" }));
      await user.type(screen.getByRole("searchbox"), "no-such-item");
      expect(screen.getByRole("status")).toHaveTextContent("No items match");
      await user.clear(screen.getByRole("searchbox"));
      await user.type(screen.getByRole("searchbox"), chosen.name);
      await user.click(screen.getByRole("button", { name: chosen.name }));
      expect(onChange).toHaveBeenCalledExactlyOnceWith(chosen.id);
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Choose" }));
      expect(screen.getByRole("searchbox")).toHaveValue("");
      view.unmount();
    }
  );

  it("restricts Light Cones by Path, excludes duplicates, and clears individual slots", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values.find(
      (entry) => entry.id === "1308"
    )!;
    const compatible = references.lightCones.values.filter(
      (entry) => entry.path_id === character.path_id
    );
    const incompatible = references.lightCones.values.find(
      (entry) => entry.path_id !== character.path_id
    )!;
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <CharacterLightCones character={character} references={references} />
      </I18nProvider>
    );
    await user.click(screen.getByRole("button", { name: "Add Light Cone" }));
    expect(
      screen.queryByRole("button", {
        name: incompatible.name.en!.value,
      })
    ).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: compatible[0]!.name.en!.value,
      })
    );
    expect(
      useWorkspaceStore.getState().characterLightConeIds[character.id]
    ).toEqual([compatible[0]!.id]);
    await user.click(screen.getByRole("button", { name: "Add Light Cone" }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", {
        name: compatible[0]!.name.en!.value,
      })
    ).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: compatible[1]!.name.en!.value,
      })
    );
    await user.click(
      screen.getByRole("button", {
        name: `Light Cone 1: ${compatible[0]!.name.en!.value}`,
      })
    );
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      useWorkspaceStore.getState().characterLightConeIds[character.id]
    ).toEqual([compatible[1]!.id]);
  });

  it("shows rarity, Combat Type, Path, and sourced affiliation", async () => {
    const references = await loadBuildReferences();
    render(
      <I18nProvider>
        <CharacterInfo
          character={references.characters.byId.get("1001")!}
          properties={references.properties}
        />
      </I18nProvider>
    );
    expect(screen.getByLabelText("4-star")).toBeVisible();
    expect(screen.getByText("Astral Express")).toBeVisible();
    expect(screen.getByText("Ice")).toBeVisible();
    expect(screen.getByText("Preservation")).toBeVisible();
  });

  it("supports custom triggers, header content, multi-highlight and staying open", async () => {
    const items = [
      { id: "a", name: "Alpha", searchText: "", iconPath: "", rarity: 5 },
      { id: "b", name: "Beta", searchText: "", iconPath: "", rarity: 4 },
    ];
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <I18nProvider>
        <ItemPicker
          kind="relic-set"
          items={items}
          value={null}
          selectedIds={["a", "b"]}
          label="Sets"
          triggerLabel="Sets: Alpha and Beta"
          onChange={onChange}
          closeOnSelect={false}
          contentHeader={<p>Header row</p>}
          renderTrigger={({ open }) => (
            <span data-testid="custom-trigger">{open ? "open" : "closed"}</span>
          )}
        />
        <ItemPicker
          kind="light-cone"
          items={items}
          value={null}
          label="Empty"
          triggerSize="sm"
          onChange={vi.fn()}
        />
      </I18nProvider>
    );
    expect(container.querySelector("[data-item-picker-empty]")).toHaveStyle({
      width: "48px",
    });
    const trigger = screen.getByRole("button", {
      name: "Sets: Alpha and Beta",
    });
    expect(trigger).not.toHaveClass("border");
    await user.click(trigger);
    expect(screen.getByTestId("custom-trigger")).toHaveTextContent("open");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Header row")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Alpha" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("button", { name: "Beta" })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
