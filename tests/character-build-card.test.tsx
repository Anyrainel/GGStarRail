import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CharacterBuildCard } from "@/components/artifact-builds/CharacterBuildCard";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import { createDemoAccount } from "@/lib/demoAccount";

describe("CharacterBuildCard", () => {
  it("composes Character and equipped Light Cone metadata into same-row ItemIcons", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
      loadBuildReferences(),
    ]);
    const ownedCharacter = account.characters[0];
    if (!ownedCharacter) throw new Error("Demo Character missing");
    const character = references.characters.byId.get(
      ownedCharacter.definitionId
    );
    if (!character) throw new Error("Character definition missing");
    const lightCone = account.lightCones.find(
      (item) => item.key === ownedCharacter.lightConeKey
    );
    if (!lightCone) throw new Error("Equipped Light Cone missing");

    const profile = createCharacterScoreProfile(
      character,
      references.progression,
      "Card profile",
      "score:card"
    );
    const build = createCharacterBuild(
      character,
      ownedCharacter.key,
      account.relics,
      references.relicSets.values,
      references.properties,
      references.progression,
      profile.id,
      "Card build",
      "build:card"
    );

    const { container } = render(
      <I18nProvider>
        <MemoryRouter>
          <CharacterBuildCard
            character={character}
            ownedCharacter={ownedCharacter}
            equippedLightCone={lightCone}
            builds={[build]}
            profiles={new Map([[profile.id, profile]])}
            references={references}
            onAddBuild={vi.fn()}
            onBuildChange={vi.fn()}
            onProfileChange={vi.fn()}
            onDeleteBuild={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    const card = container.querySelector("[data-character-build-card]");
    const header = card?.querySelector("[data-character-build-header]");
    const characterIcon = header?.querySelector(
      "[data-item-icon-kind='character']"
    );
    const lightConeIcon = header?.querySelector(
      "[data-item-icon-kind='light-cone']"
    );

    expect(card).not.toBeNull();
    expect(header).not.toBeNull();
    expect(characterIcon).toHaveAttribute(
      "data-item-level",
      `Lv. ${ownedCharacter.level}`
    );
    expect(characterIcon).toHaveAttribute(
      "data-item-rarity",
      String(character.rarity)
    );
    expect(
      characterIcon?.querySelector(
        `[data-item-badge='${ownedCharacter.eidolon}']`
      )
    ).not.toBeNull();
    expect(lightConeIcon).toHaveAttribute(
      "data-item-rarity",
      String(references.lightCones.byId.get(lightCone.definitionId)?.rarity)
    );
    expect(lightConeIcon).toHaveAttribute(
      "data-item-level",
      `Lv. ${lightCone.level}`
    );
    expect(
      lightConeIcon?.querySelector(
        `[data-item-badge='${lightCone.superimposition}']`
      )
    ).not.toBeNull();
    expect(lightConeIcon?.querySelector("[data-item-lock]")).not.toBeNull();
    expect(
      within(card as HTMLElement).getByRole("textbox", { name: "Build name" })
    ).toHaveValue("Card build");
    expect(
      within(card as HTMLElement).getByRole("button", { name: "Add Build" })
    ).toBeVisible();
  });

  it("uses the compact GGArtifact add-first-build state", async () => {
    const [account, references] = await Promise.all([
      createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
      loadBuildReferences(),
    ]);
    const ownedCharacter = account.characters[0];
    if (!ownedCharacter) throw new Error("Demo Character missing");
    const character = references.characters.byId.get(
      ownedCharacter.definitionId
    );
    if (!character) throw new Error("Character definition missing");
    const onAddBuild = vi.fn();

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

    expect(
      container.querySelector("[data-item-icon-kind='character']")
    ).not.toBeNull();
    expect(container.querySelector("[data-item-icon-kind='light-cone']")).toBe(
      null
    );
    screen.getByRole("button", { name: "Add First Build" }).click();
    expect(onAddBuild).toHaveBeenCalledOnce();
  });
});
