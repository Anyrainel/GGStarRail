import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import {
  canonicalCharacterId,
  TRAILBLAZER_FORMS,
} from "@/domain/characterIdentity";
import { TierDocumentSchema } from "@/domain/tier-list/document";
import { I18nProvider } from "@/i18n/I18nContext";
import CharacterTierListView from "@/pages/tier-list/CharacterTierListView";
import { loadCharacters } from "@/providers/gilore/catalog";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useTierLibraryStore } from "@/stores/useTierLibraryStore";
import { useTrailblazerAppearanceStore } from "@/stores/useTrailblazerAppearanceStore";

const assignments = {
  "8001": { tier: "B", position: 3 },
  "8002": { tier: "S", position: 1 },
  "8004": { tier: "A", position: 0 },
  "1001": { tier: "D", position: 0 },
} as const;
const expected = {
  "8001": assignments["8002"],
  "8003": assignments["8004"],
  "1001": assignments["1001"],
};

beforeEach(() => {
  useCharacterPriorityStore.getState().resetPriorities();
  useTrailblazerAppearanceStore.getState().setAppearance("caelus");
  useTierLibraryStore.setState({ documents: {}, active: {} });
});

describe("Trailblazer identity", () => {
  it("enumerates one kit per Path and preserves exact source variants for imports", async () => {
    const catalog = await loadCharacters();
    for (const form of TRAILBLAZER_FORMS) {
      expect(canonicalCharacterId(form.stelle)).toBe(form.id);
      expect(
        catalog.identities.filter(
          (entry) => canonicalCharacterId(entry.id) === form.id
        )
      ).toHaveLength(1);
      expect(catalog.byId.get(form.stelle)?.id).toBe(form.stelle);
      expect(catalog.byId.get(form.caelus)?.path_id).toBe(
        catalog.byId.get(form.stelle)?.path_id
      );
    }
  });

  it.each([
    0, 1, 2,
  ])("hydrates v%s saved ranks through the real store without losing the higher placement", async (version) => {
    const state =
      version === 0
        ? { assignments }
        : {
            schemaVersion: version,
            assignments,
            groupAssignments: {},
            updatedAt: 123,
          };
    localStorage.setItem(
      STORAGE_KEYS.characterPriority,
      JSON.stringify({ state, version })
    );
    await useCharacterPriorityStore.persist.rehydrate();
    expect(useCharacterPriorityStore.getState().assignments).toEqual(expected);
    expect(useCharacterPriorityStore.getState().schemaVersion).toBe(2);
  });

  it("migrates JSON imports and saved libraries with the same identity rules", async () => {
    const document = {
      kind: "ggstarrail.tier-list",
      schemaVersion: 1,
      category: "character",
      assignments,
      groupAssignments: {},
      presentation: { title: "Old list", hidden: [], labels: {} },
    };
    const parsed = TierDocumentSchema.parse(document);
    expect(parsed.assignments).toEqual(expected);
    expect(parsed.schemaVersion).toBe(2);
    localStorage.setItem(
      STORAGE_KEYS.tierLibrary,
      JSON.stringify({
        version: 1,
        state: { documents: { old: document }, active: { character: "old" } },
      })
    );
    await useTierLibraryStore.persist.rehydrate();
    expect(useTierLibraryStore.getState().documents.old).toEqual(parsed);
    expect(useTierLibraryStore.getState().active.character).toBe("old");
  });

  it("switches all portraits without changing the canonical rank or entry count", async () => {
    const user = userEvent.setup();
    act(() =>
      useCharacterPriorityStore.getState().setPriorityState({
        assignments: { "8001": { tier: "S", position: 0 } },
      })
    );
    const { container } = render(
      <I18nProvider>
        <MemoryRouter>
          <CharacterTierListView />
        </MemoryRouter>
      </I18nProvider>
    );
    const toggle = await screen.findByRole(
      "group",
      { name: "Trailblazer appearance" },
      { timeout: 15000 }
    );
    await user.click(screen.getByRole("tab", { name: "Physical" }));
    const before = container.querySelectorAll("[data-priority-item-id]").length;
    await user.click(within(toggle).getByRole("button", { name: "Stelle" }));
    await waitFor(() =>
      expect(
        container.querySelector('[data-priority-item-id="8001"]')
      ).toHaveAttribute("aria-label", "Trailblazer · Stelle")
    );
    expect(
      container.querySelector('[data-priority-item-id="8002"]')
    ).toBeNull();
    expect(container.querySelectorAll("[data-priority-item-id]")).toHaveLength(
      before
    );
    expect(useCharacterPriorityStore.getState().assignments).toEqual({
      "8001": { tier: "S", position: 0 },
    });
    expect(useTrailblazerAppearanceStore.getState().appearance).toBe("stelle");
    await useTrailblazerAppearanceStore.persist.rehydrate();
    expect(useTrailblazerAppearanceStore.getState().appearance).toBe("stelle");
  });
});
