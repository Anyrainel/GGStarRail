import { render, screen } from "@testing-library/react";
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

  it("adds each category independently without a set-selection dialog", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values[0]!;
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
    await user.click(screen.getByRole("button", { name: "Add Cavern build" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onAddBuild).toHaveBeenCalledExactlyOnceWith("cavern");
    await user.click(screen.getByRole("button", { name: "Add Planar build" }));
    expect(onAddBuild).toHaveBeenLastCalledWith("planar");
  });
});
