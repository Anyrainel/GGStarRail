import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterBuildCard } from "@/components/builds/CharacterBuildCard";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

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

  it("adds each category independently from one centred row without headings", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values[0]!;
    const onAddBuild = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
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
    expect(container.querySelector("h3")).toBeNull();
    expect(container.querySelector("[data-build-column]")).toBeNull();
    const cavern = screen.getByRole("button", {
      name: "Add Cavern Relic build",
    });
    const planar = screen.getByRole("button", {
      name: "Add Planar Ornament build",
    });
    expect(cavern.parentElement).toBe(planar.parentElement);
    expect(
      cavern.querySelector('[data-relic-kind-icon="cavern"]')
    ).not.toBeNull();
    expect(
      planar.querySelector('[data-relic-kind-icon="planar"]')
    ).not.toBeNull();
    await user.click(cavern);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onAddBuild).toHaveBeenCalledExactlyOnceWith("cavern");
    await user.click(planar);
    expect(onAddBuild).toHaveBeenLastCalledWith("planar");
  });

  it("labels only non-empty columns and puts an add bar under each", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values[0]!;
    const profile = createCharacterScoreProfile(
      character,
      references.progression,
      "Score",
      "score:column-test"
    );
    const build = createCharacterBuild(
      character,
      {
        category: "cavern",
        cavern: {
          mode: "four-piece",
          setId: references.relicSets.values.find(
            (set) => set.kind === "cavern_relic"
          )!.id,
        },
      },
      references.properties,
      references.progression,
      profile.id,
      "Column build",
      "build:column-test"
    );
    const onAddBuild = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <I18nProvider>
        <MemoryRouter>
          <CharacterBuildCard
            character={character}
            builds={[build]}
            profiles={new Map([[profile.id, profile]])}
            references={references}
            onAddBuild={onAddBuild}
            onBuildChange={vi.fn()}
            onProfileChange={vi.fn()}
            onDeleteBuild={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>
    );
    const cavern = container.querySelector(
      '[data-build-column="cavern"]'
    ) as HTMLElement;
    const planar = container.querySelector(
      '[data-build-column="planar"]'
    ) as HTMLElement;
    expect(
      within(cavern).getByRole("heading", { name: "Cavern Relics" })
    ).toBeVisible();
    expect(within(planar).queryByRole("heading")).toBeNull();
    expect(cavern.querySelectorAll("[data-build-card]")).toHaveLength(1);
    const cavernBar = within(cavern).getByRole("button", {
      name: "Add Cavern Relic build",
    });
    expect(cavernBar).toHaveClass("flex-1");
    expect(cavern.lastElementChild).toContainElement(cavernBar);
    await user.click(
      within(planar).getByRole("button", { name: "Add Planar Ornament build" })
    );
    expect(onAddBuild).toHaveBeenLastCalledWith("planar");
  });

  it("caps the visible Light Cones at three on tablet widths", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.values.find(
      (entry) => entry.id === "1308"
    )!;
    const compatible = references.lightCones.values
      .filter((entry) => entry.path_id === character.path_id)
      .slice(0, 4);
    act(() =>
      useWorkspaceStore.getState().setCharacterLightCones(
        character.id,
        compatible.map(({ id }) => id)
      )
    );
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
    const slots = container.querySelector(
      "[data-character-light-cones]"
    ) as HTMLElement;
    expect(slots).not.toHaveClass("overflow-x-auto");
    expect(
      within(slots).getAllByRole("button", { name: /^Light Cone \d:/ })
    ).toHaveLength(3);
    expect(
      within(slots).queryByRole("button", { name: "Add Light Cone" })
    ).toBeNull();
  });
});
