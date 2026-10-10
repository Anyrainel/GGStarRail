import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterLightCones } from "@/components/builds/CharacterLightCones";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import {
  catalogPickerItems,
  rarityPickerFilter,
} from "@/lib/catalogPickerItems";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

afterEach(() => act(() => useWorkspaceStore.getState().clearWorkspace()));

describe("shared catalog picker", () => {
  it.each([
    "character",
    "light-cone",
    "relic-set",
  ] as const)("searches and selects %s with the same controls", async (kind) => {
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
  });

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
        name: incompatible.name.en.value,
      })
    ).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: compatible[0]!.name.en.value,
      })
    );
    expect(
      useWorkspaceStore.getState().characterLightConeIds[character.id]
    ).toEqual([compatible[0]!.id]);
    await user.click(screen.getByRole("button", { name: "Add Light Cone" }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", {
        name: compatible[0]!.name.en.value,
      })
    ).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: compatible[1]!.name.en.value,
      })
    );
    await user.click(
      screen.getByRole("button", {
        name: `Light Cone 1: ${compatible[0]!.name.en.value}`,
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
});
