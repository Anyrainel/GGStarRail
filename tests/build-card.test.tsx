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

    const cavernIcon = screen.getByRole("img", {
      name: /Cavern 4-piece set:/,
    });
    const planarIcon = screen.getByRole("img", {
      name: /Planar 2-piece set:/,
    });
    expect(cavernIcon).toHaveAttribute("data-item-icon-kind", "relic-set");
    expect(within(cavernIcon).getByText("4")).toHaveAttribute(
      "data-item-badge",
      "4"
    );
    expect(within(planarIcon).getByText("2")).toHaveAttribute(
      "data-item-badge",
      "2"
    );

    const cavernSetId =
      build.cavern.mode === "four-piece"
        ? build.cavern.setId
        : build.cavern.setIds[0];
    const expectedCavernRarity = Math.max(
      1,
      ...references.relicPieces.values
        .filter((piece) => piece.set_id === cavernSetId)
        .map((piece) => piece.rarity)
    );
    expect(cavernIcon).toHaveAttribute(
      "data-item-rarity",
      String(expectedCavernRarity)
    );

    for (const slot of [
      "Head",
      "Hands",
      "Body",
      "Feet",
      "Planar Sphere",
      "Link Rope",
    ]) {
      expect(screen.getByRole("group", { name: slot })).toBeVisible();
    }
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

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Cavern 4-piece set" }),
      replacement.id
    );
    expect(onBuildChange).toHaveBeenCalledWith({
      ...build,
      cavern: { mode: "four-piece", setId: replacement.id },
    });

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete build" })
    );
    expect(onDelete).toHaveBeenCalledOnce();

    await user.click(
      screen.getByText("Configure scoring weights and grade thresholds")
    );
    expect(screen.getByRole("slider", { name: "HP%" })).toBeVisible();
  });
});
