import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CharacterBuildCard } from "@/components/artifact-builds/CharacterBuildCard";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";

describe("CharacterBuildCard", () => {
  it("shows generic catalog identity without equipped gear or account upgrades", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values[0]!;
    const { container } = render(
      <I18nProvider>
        <MemoryRouter>
          <CharacterBuildCard
            character={character}
            builds={[]}
            profiles={new Map()}
            references={references}
            onAddBuild={vi.fn()}
            onBuildChange={vi.fn()}
            onProfileChange={vi.fn()}
            onDeleteBuild={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>
    );
    const header = container.querySelector("[data-character-build-header]");
    const icon = header?.querySelector("[data-item-icon-kind='character']");
    expect(icon).toHaveAttribute("data-item-rarity", String(character.rarity));
    expect(icon).not.toHaveAttribute("data-item-level");
    expect(header?.querySelector("[data-item-badge]")).toBeNull();
    expect(header?.querySelector("[data-item-lock]")).toBeNull();
    expect(
      header?.querySelector("[data-item-icon-kind='light-cone']")
    ).toBeNull();
  });

  it("requires explicit set choices before creating a build", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values[0]!;
    const cavern = references.relicSets.values.find(
      (set) => set.kind === "cavern_relic"
    )!;
    const planar = references.relicSets.values.find(
      (set) => set.kind === "planar_ornament"
    )!;
    const onAddBuild = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <MemoryRouter>
          <CharacterBuildCard
            character={character}
            builds={[]}
            profiles={new Map()}
            references={references}
            onAddBuild={onAddBuild}
            onBuildChange={vi.fn()}
            onProfileChange={vi.fn()}
            onDeleteBuild={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>
    );
    await user.click(screen.getByRole("button", { name: "Add First Build" }));
    const dialog = screen.getByRole("dialog");
    const create = within(dialog).getByRole("button", { name: "Add Build" });
    expect(create).toBeDisabled();
    expect(onAddBuild).not.toHaveBeenCalled();
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Cavern 4-piece set" }),
      cavern.id
    );
    expect(create).toBeDisabled();
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Planar 2-piece set" }),
      planar.id
    );
    await user.click(create);
    expect(onAddBuild).toHaveBeenCalledExactlyOnceWith({
      cavern: { mode: "four-piece", setId: cavern.id },
      planarSetId: planar.id,
    });
  });
});
