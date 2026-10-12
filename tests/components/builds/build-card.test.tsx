import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BuildCard } from "@/components/builds/BuildCard";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import { localizedPropertyName } from "@/services/catalog/presentation";

async function prepareCard() {
  const references = await loadBuildReferences();
  const character = references.characters.values[0];
  if (!character) throw new Error("Character reference missing");
  const profile = createCharacterScoreProfile(
    character,
    references.progression,
    "Card score",
    "score:build-card"
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
    "Card build",
    "build:build-card"
  );
  return { build, profile, references };
}

describe("BuildCard", () => {
  it("keeps both Cavern 2-piece sets editable without converting the build", async () => {
    const { build, profile, references } = await prepareCard();
    const [first, second, replacement] = references.relicSets.values.filter(
      (set) => set.kind === "cavern_relic"
    );
    if (!first || !second || !replacement)
      throw new Error("Cavern sets missing");
    const mixedBuild = {
      ...build,
      cavern: {
        mode: "two-plus-two" as const,
        setIds: [first.id, second.id] as [string, string],
      },
    };
    const onBuildChange = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <I18nProvider>
        <BuildCard
          build={mixedBuild}
          profile={profile}
          references={references}
          onBuildChange={onBuildChange}
          onProfileChange={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>
    );
    const trigger = screen.getByRole("button", {
      name: `Cavern Relic set: ${first.name.en.value} 2-piece + ${second.name.en.value} 2-piece`,
    });
    expect(trigger.querySelector('[data-set-plan="split"]')).not.toBeNull();
    expect(
      view.container.querySelector("[data-set-plan-names]")
    ).toHaveTextContent(`${first.name.en.value}${second.name.en.value}`);
    expect(
      screen.queryByRole("button", { name: /^Cavern mode|^4$|^2\+2$/ })
    ).toBeNull();

    await user.click(trigger);
    expect(screen.getByRole("tab", { name: "2+2" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      screen.getByRole("button", { name: first.name.en.value })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: second.name.en.value })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      screen.getByRole("button", { name: replacement.name.en.value })
    );
    expect(onBuildChange).toHaveBeenLastCalledWith({
      ...mixedBuild,
      cavern: { mode: "two-plus-two", setIds: [replacement.id, second.id] },
    });
  });

  it("switches a 4-piece plan to 2+2 inside the set picker and back", async () => {
    const { build, profile, references } = await prepareCard();
    if (build.category !== "cavern" || build.cavern.mode !== "four-piece")
      throw new Error("Expected a 4-piece Cavern build");
    const current = build.cavern.setId;
    const other = references.relicSets.values.find(
      (set) => set.kind === "cavern_relic" && set.id !== current
    );
    if (!other) throw new Error("Second Cavern set missing");
    const onBuildChange = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <BuildCard
          build={build}
          profile={profile}
          references={references}
          onBuildChange={onBuildChange}
          onProfileChange={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>
    );

    await user.click(
      screen.getByRole("button", { name: /^Cavern Relic set: .* 4-piece$/ })
    );
    await user.click(screen.getByRole("tab", { name: "2+2" }));
    expect(screen.getByRole("button", { name: /^2nd/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(screen.getByRole("button", { name: other.name.en.value }));
    expect(onBuildChange).toHaveBeenLastCalledWith({
      ...build,
      cavern: { mode: "two-plus-two", setIds: [current, other.id] },
    });

    onBuildChange.mockClear();
    await user.click(
      screen.getByRole("button", { name: /^Cavern Relic set: .* 4-piece$/ })
    );
    await user.click(screen.getByRole("tab", { name: "2+2" }));
    const currentName = references.relicSets.byId.get(current)!.name.en.value;
    await user.click(screen.getByRole("button", { name: currentName }));
    expect(onBuildChange).toHaveBeenLastCalledWith({
      ...build,
      cavern: { mode: "four-piece", setId: current },
    });
  });

  it("shows only Cavern sets and Body/Feet main stats on a Cavern card", async () => {
    const { build, profile, references } = await prepareCard();
    const view = render(
      <I18nProvider>
        <BuildCard
          build={build}
          profile={profile}
          references={references}
          onBuildChange={vi.fn()}
          onProfileChange={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>
    );

    const card = view.container.querySelector("[data-build-card]");
    expect(card).not.toBeNull();
    expect(card?.querySelectorAll("[data-build-slot]")).toHaveLength(2);

    const cavernTrigger = screen.getByRole("button", {
      name: /^Cavern Relic set: .* 4-piece$/,
    });
    expect(
      screen.queryByRole("button", { name: /^Planar Ornament set:/ })
    ).toBeNull();
    const cavernIcon = cavernTrigger.querySelector(
      '[data-item-icon-kind="relic-set"]'
    );
    expect(cavernIcon).not.toBeNull();
    expect(cavernIcon).toHaveAttribute("data-item-icon-kind", "relic-set");
    expect(within(cavernIcon as HTMLElement).getByText("4")).toHaveAttribute(
      "data-item-badge",
      "4"
    );

    const cavernSetId =
      build.cavern.mode === "four-piece"
        ? build.cavern.setId
        : build.cavern.setIds[0];
    const cavernRarities = references.relicPieces.values
      .filter((piece) => piece.set_id === cavernSetId)
      .map((piece) => piece.rarity);
    const expectedCavernRarity =
      cavernRarities.length > 0 ? Math.max(...cavernRarities) : "unknown";
    expect(cavernIcon).toHaveAttribute(
      "data-item-rarity",
      String(expectedCavernRarity)
    );

    for (const slot of ["body", "feet"]) {
      const slotNode = card?.querySelector(`[data-build-slot="${slot}"]`);
      expect(slotNode).not.toBeNull();
      expect(
        within(slotNode as HTMLElement).getAllByRole("combobox").length
      ).toBeGreaterThan(0);
    }
    expect(card?.querySelector('[data-build-slot="head"]')).toBeNull();
    expect(card?.querySelector('[data-build-slot="hands"]')).toBeNull();
    expect(card).not.toHaveTextContent(/\+\d/);
    expect(card?.querySelector("fieldset")).toBeNull();
    expect(card?.querySelector("select")).toBeNull();
  });

  it("uses individual stat selects with full-label options, deselect, and add", async () => {
    const { build, profile, references } = await prepareCard();
    const bodyOptions =
      references.properties.relicSlotById.get("BODY")?.valid_main_properties ??
      [];
    const [first, second, additional] = bodyOptions;
    if (!first || !second || !additional) {
      throw new Error("Body main-stat references missing");
    }
    const editedBuild = {
      ...build,
      preferredMainStats: {
        ...build.preferredMainStats,
        body: [first, second],
      },
    };
    const onBuildChange = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <I18nProvider>
        <BuildCard
          build={editedBuild}
          profile={profile}
          references={references}
          onBuildChange={onBuildChange}
          onProfileChange={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>
    );

    const bodySlot = view.container.querySelector('[data-build-slot="body"]');
    if (!(bodySlot instanceof HTMLElement)) {
      throw new Error("Body main-stat controls missing");
    }
    expect(within(bodySlot).getAllByRole("combobox")).toHaveLength(2);
    expect(bodySlot).not.toHaveTextContent("+1");

    await user.click(within(bodySlot).getAllByRole("combobox")[0]!);
    expect(await screen.findByRole("listbox")).toBeVisible();
    expect(
      screen.getByRole("option", {
        name: localizedPropertyName(additional, references.properties, "en"),
      })
    ).toBeVisible();
    await user.click(screen.getByRole("option", { name: "Deselect" }));
    expect(onBuildChange).toHaveBeenLastCalledWith({
      ...editedBuild,
      preferredMainStats: {
        ...editedBuild.preferredMainStats,
        body: [second],
      },
    });

    await user.click(
      within(bodySlot).getByRole("button", {
        name: "Add a Body main stat",
      })
    );
    expect(await screen.findByRole("listbox")).toBeVisible();
    await user.click(
      screen.getByRole("option", {
        name: localizedPropertyName(additional, references.properties, "en"),
      })
    );
    expect(onBuildChange).toHaveBeenLastCalledWith({
      ...editedBuild,
      preferredMainStats: {
        ...editedBuild.preferredMainStats,
        body: [first, second, additional],
      },
    });
  });

  it("keeps set selection, naming, scoring, and delete actions editable", async () => {
    const { build, profile, references } = await prepareCard();
    const user = userEvent.setup();
    const onBuildChange = vi.fn();
    const onDelete = vi.fn();
    render(
      <I18nProvider>
        <BuildCard
          build={build}
          profile={profile}
          references={references}
          onBuildChange={onBuildChange}
          onProfileChange={vi.fn()}
          onDelete={onDelete}
        />
      </I18nProvider>
    );

    const cavernOptions = references.relicSets.values.filter(
      (set) => set.kind === "cavern_relic"
    );
    const replacement = cavernOptions.find((set) => {
      const current =
        build.cavern.mode === "four-piece"
          ? build.cavern.setId
          : build.cavern.setIds[0];
      return set.id !== current;
    });
    if (!replacement) throw new Error("Second Cavern set reference missing");

    await user.click(
      screen.getByRole("button", { name: /^Cavern Relic set:/ })
    );
    expect(
      await screen.findByRole("searchbox", {
        name: "Search: Cavern Relic set",
      })
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: replacement.name.en.value })
    );
    expect(onBuildChange).toHaveBeenCalledWith({
      ...build,
      cavern: { mode: "four-piece", setId: replacement.id },
    });

    const bodyTrigger = screen.getAllByRole("combobox", { name: /^Body:/ })[0];
    if (!bodyTrigger) throw new Error("Body main-stat trigger missing");
    await user.click(bodyTrigger);
    expect(await screen.findByRole("listbox")).toBeVisible();
    expect(screen.getByRole("option", { name: "Deselect" })).toBeVisible();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(1);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete build" })
    );
    expect(onDelete).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Configure scoring weights and grade thresholds",
      })
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      within(screen.getByRole("dialog")).queryByRole("combobox")
    ).toBeNull();
    expect(screen.getByRole("slider", { name: "HP%" })).toBeVisible();
  });
  it("adds a substat weight from the label row and keeps chips in one family", async () => {
    const { build, profile, references } = await prepareCard();
    const [unweighted] = Object.keys(profile.statWeights);
    if (!unweighted) throw new Error("Score profile weights missing");
    const editedProfile = {
      ...profile,
      statWeights: { ...profile.statWeights, [unweighted]: 0 },
    };
    const onProfileChange = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <I18nProvider>
        <BuildCard
          build={build}
          profile={editedProfile}
          references={references}
          onBuildChange={vi.fn()}
          onProfileChange={onProfileChange}
          onDelete={vi.fn()}
        />
      </I18nProvider>
    );
    const substats = view.container.querySelector("[data-build-substats]");
    if (!(substats instanceof HTMLElement))
      throw new Error("Substat row missing");
    expect(within(substats).getByText("Substats")).toBeVisible();
    const bodyChip = within(
      view.container.querySelector('[data-build-slot="body"]') as HTMLElement
    ).getAllByRole("combobox")[0]!;
    expect(bodyChip).toHaveClass("h-7", "min-w-[3.5rem]", "[&>svg]:hidden");

    await user.click(
      within(substats).getByRole("combobox", { name: "Add a substat weight" })
    );
    await user.click(
      await screen.findByRole("option", {
        name: localizedPropertyName(unweighted, references.properties, "en"),
      })
    );
    expect(onProfileChange).toHaveBeenLastCalledWith({
      ...editedProfile,
      statWeights: { ...editedProfile.statWeights, [unweighted]: 1 },
    });
  });
});
