import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BuildCard } from "@/components/artifact-builds/BuildCard";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";

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
    undefined,
    [],
    references.relicSets.values,
    references.properties,
    references.progression,
    profile.id,
    "Card build",
    "build:build-card"
  );
  return { build, profile, references };
}

describe("BuildCard", () => {
  it("uses ItemIcons for the 4+2 set plan and keeps all six slots compact", async () => {
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
    expect(card?.querySelectorAll("[data-build-slot]")).toHaveLength(6);

    const cavernTrigger = screen.getByRole("button", {
      name: /Cavern 4-piece set:/,
    });
    const planarTrigger = screen.getByRole("button", {
      name: /Planar 2-piece set:/,
    });
    const cavernIcon = cavernTrigger.querySelector(
      '[data-item-icon-kind="relic-set"]'
    );
    const planarIcon = planarTrigger.querySelector(
      '[data-item-icon-kind="relic-set"]'
    );
    expect(cavernIcon).not.toBeNull();
    expect(planarIcon).not.toBeNull();
    expect(cavernIcon).toHaveAttribute("data-item-icon-kind", "relic-set");
    expect(within(cavernIcon as HTMLElement).getByText("4")).toHaveAttribute(
      "data-item-badge",
      "4"
    );
    expect(within(planarIcon as HTMLElement).getByText("2")).toHaveAttribute(
      "data-item-badge",
      "2"
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

    for (const slot of [
      "head",
      "hands",
      "body",
      "feet",
      "planarSphere",
      "linkRope",
    ]) {
      const slotNode = card?.querySelector(`[data-build-slot="${slot}"]`);
      expect(slotNode).not.toBeNull();
      expect(slotNode?.querySelectorAll("button")).toHaveLength(1);
    }
    expect(card?.querySelector("fieldset")).toBeNull();
    expect(card?.querySelector("select")).toBeNull();
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
      screen.getByRole("button", { name: /Cavern 4-piece set:/ })
    );
    expect(
      await screen.findByRole("searchbox", {
        name: "Search: Cavern 4-piece set",
      })
    ).toBeVisible();
    await user.click(
      screen.getByRole("menuitem", { name: replacement.name.en.value })
    );
    expect(onBuildChange).toHaveBeenCalledWith({
      ...build,
      cavern: { mode: "four-piece", setId: replacement.id },
    });

    const bodyTrigger = screen.getByRole("button", { name: /^Body:/ });
    await user.click(bodyTrigger);
    expect(await screen.findByRole("menu")).toBeVisible();
    expect(screen.getAllByRole("menuitemcheckbox").length).toBeGreaterThan(1);
    expect(
      screen.getAllByRole("menuitemcheckbox", { checked: true }).length
    ).toBeGreaterThan(0);
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
    expect(screen.getByRole("slider", { name: "HP%" })).toBeVisible();
  });
});
