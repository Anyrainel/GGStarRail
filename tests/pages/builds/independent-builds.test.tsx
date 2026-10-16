import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BuildCard } from "@/components/builds/BuildCard";
import { STORAGE_KEYS } from "@/config/identity";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { evaluateAccountTriage } from "@/domain/build/evaluation";
import { deriveBuildFilters } from "@/domain/build/filters";
import { I18nProvider } from "@/i18n/I18nContext";
import RelicFiltersView from "@/pages/builds/RelicFiltersView";
import { parseBackup, serializeBackup } from "@/services/backup/workspace";
import {
  parseBuildWorkspaceBundle,
  serializeBuildWorkspaceBundle,
} from "@/services/builds/bundle";
import {
  createRelicScoringContext,
  loadBuildReferences,
} from "@/services/catalog/buildReferences";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "../../fixtures/demoAccount";

afterEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
  localStorage.removeItem(STORAGE_KEYS.workspace);
});

async function fixture() {
  const references = await loadBuildReferences();
  const character = references.characters.values[0]!;
  const profile = createCharacterScoreProfile(
    character,
    references.progression,
    "Cavern score",
    "score:cavern"
  );
  const planarProfile = {
    ...structuredClone(profile),
    id: "score:planar",
    name: "Planar score",
    statWeights: {},
  };
  const cavernSets = references.relicSets.values.filter(
    (set) => set.kind === "cavern_relic"
  );
  const planarSets = references.relicSets.values.filter(
    (set) => set.kind === "planar_ornament"
  );
  const cavern = createCharacterBuild(
    character,
    {
      category: "cavern",
      cavern: { mode: "four-piece", setId: cavernSets[0]!.id },
    },
    references.properties,
    references.progression,
    profile.id,
    "Cavern A",
    "build:cavern-a"
  );
  const planar = createCharacterBuild(
    character,
    { category: "planar", planarSetId: planarSets[0]!.id },
    references.properties,
    references.progression,
    planarProfile.id,
    "Planar A",
    "build:planar-a"
  );
  const secondCavern = {
    ...cavern,
    id: "build:cavern-b",
    name: "Cavern B",
    cavern: { mode: "four-piece" as const, setId: cavernSets[1]!.id },
  };
  const secondPlanar = {
    ...planar,
    id: "build:planar-b",
    name: "Planar B",
    planarSetId: planarSets[1]!.id,
  };
  return {
    references,
    profile,
    planarProfile,
    cavern,
    planar,
    secondCavern,
    secondPlanar,
  };
}

describe("independent Cavern and Planar builds", () => {
  it("round-trips independent v1 cards through hydration, backup, and build bundles", async () => {
    const { cavern, planar, profile, planarProfile } = await fixture();
    const workspace = {
      ...structuredClone(DEFAULT_WORKSPACE),
      builds: [cavern, planar],
      scoreProfiles: [profile, planarProfile],
    };
    useWorkspaceStore.getState().replaceWorkspace(workspace);
    const persisted = localStorage.getItem(STORAGE_KEYS.workspace)!;
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.setItem(STORAGE_KEYS.workspace, persisted);
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState().builds).toEqual(workspace.builds);
    expect(parseBackup(serializeBackup(workspace)).payload).toEqual(workspace);
    const bundle = parseBuildWorkspaceBundle(
      serializeBuildWorkspaceBundle({
        builds: workspace.builds,
        scoreProfiles: workspace.scoreProfiles,
        triageRules: workspace.triageRules,
        characterLightConeIds: workspace.characterLightConeIds,
      })
    );
    expect(bundle.schemaVersion).toBe(3);
    expect(bundle.builds).toEqual(workspace.builds);
    expect(bundle.scoreProfiles).toEqual(workspace.scoreProfiles);
    for (const version of [0, 4])
      expect(() =>
        parseBuildWorkspaceBundle(
          JSON.stringify({ ...bundle, schemaVersion: version })
        )
      ).toThrow();
    const paired = {
      ...cavern,
      planarSetId: planar.planarSetId,
      preferredMainStats: {
        ...cavern.preferredMainStats,
        ...planar.preferredMainStats,
      },
    };
    expect(() =>
      parseBuildWorkspaceBundle(JSON.stringify({ ...bundle, builds: [paired] }))
    ).toThrow();
  });
  it("cross-selects either category without changing the other category's filters or score profile", async () => {
    const {
      cavern,
      planar,
      secondCavern,
      secondPlanar,
      profile,
      planarProfile,
      references,
    } = await fixture();
    useWorkspaceStore.getState().replaceBuildWorkspace({
      builds: [cavern, planar, secondCavern, secondPlanar],
      scoreProfiles: [profile, planarProfile],
      triageRules: DEFAULT_WORKSPACE.triageRules,
    });
    render(
      <I18nProvider>
        <MemoryRouter>
          <RelicFiltersView />
        </MemoryRouter>
      </I18nProvider>
    );
    const user = userEvent.setup();
    const setCard = (kind: "cavern" | "planar") => {
      const card = document.querySelector(`[data-filter-set-card="${kind}"]`);
      if (!(card instanceof HTMLElement))
        throw new Error(`${kind} card missing`);
      return card;
    };
    const setName = (id: string) =>
      references.relicSets.byId.get(id)!.name.en!.value;
    await screen.findByRole("combobox", { name: "Cavern Relics" });
    expect(
      screen.getByRole("region", {
        name: setName(
          cavern.cavern.mode === "four-piece" ? cavern.cavern.setId : ""
        ),
      })
    ).toBe(setCard("cavern"));
    expect(
      setCard("cavern").querySelectorAll("[data-filter-slot]")
    ).toHaveLength(4);
    expect(
      setCard("planar").querySelectorAll("[data-filter-slot]")
    ).toHaveLength(2);
    const originalCavernRule = setCard("cavern").textContent;
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Planar Ornaments" }),
      secondPlanar.id
    );
    expect(setCard("cavern").textContent).toBe(originalCavernRule);
    expect(setCard("planar")).toHaveAccessibleName(
      setName(secondPlanar.planarSetId)
    );
    const changedPlanarRule = setCard("planar").textContent;
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Cavern Relics" }),
      secondCavern.id
    );
    expect(setCard("planar").textContent).toBe(changedPlanarRule);
    expect(setCard("cavern")).toHaveAccessibleName(
      setName(secondCavern.cavern.setId)
    );
    expect(
      deriveBuildFilters(secondPlanar, planarProfile).every(
        (filter) =>
          filter.scoreProfileId === planarProfile.id &&
          filter.weightedStatIds.length === 0
      )
    ).toBe(true);
    expect(useWorkspaceStore.getState().builds).toEqual([
      cavern,
      planar,
      secondCavern,
      secondPlanar,
    ]);
  });

  it("edits only Sphere/Rope on a Planar card", async () => {
    const { planar, planarProfile, references } = await fixture();
    const changes: unknown[] = [];
    const view = render(
      <I18nProvider>
        <BuildCard
          build={planar}
          profile={planarProfile}
          references={references}
          onBuildChange={(build) => changes.push(build)}
          onProfileChange={() => {}}
          onDelete={() => {}}
        />
      </I18nProvider>
    );
    expect(view.container.querySelectorAll("[data-build-slot]")).toHaveLength(
      2
    );
    expect(view.container.querySelector('[data-build-slot="body"]')).toBeNull();
    expect(
      view.container.querySelector('[data-build-slot="planarSphere"]')
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Cavern Relic set:/ })
    ).toBeNull();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /^Planar Ornament set: .* 2-piece$/ })
    );
    const replacement = references.relicSets.values.find(
      (set) => set.kind === "planar_ornament" && set.id !== planar.planarSetId
    )!;
    await user.click(
      screen.getByRole("button", { name: replacement.name.en!.value })
    );
    expect(changes).toEqual([{ ...planar, planarSetId: replacement.id }]);
  });

  it("does not discard unconfigured Planar pieces when only Cavern cards exist", async () => {
    const { cavern, profile, references } = await fixture();
    const account = await createDemoAccount();
    const piece = account.relics.find(
      (relic) => relic.slot === "planarSphere"
    )!;
    const evaluations = evaluateAccountTriage(
      {
        ...account,
        relics: [{ ...piece, locked: false, equippedCharacterKey: undefined }],
      },
      [cavern],
      [profile],
      DEFAULT_WORKSPACE.triageRules,
      createRelicScoringContext(references)
    );
    expect(evaluations[0]!.result).toEqual({
      decision: "review",
      reasons: ["no-builds"],
    });
  });

  it("reorders only sibling cards of the same category", async () => {
    const { cavern, planar, secondCavern, profile, planarProfile } =
      await fixture();
    useWorkspaceStore.getState().replaceBuildWorkspace({
      builds: [cavern, planar, secondCavern],
      scoreProfiles: [profile, planarProfile],
      triageRules: DEFAULT_WORKSPACE.triageRules,
    });
    useWorkspaceStore.getState().moveBuild(secondCavern.id, "up");
    expect(useWorkspaceStore.getState().builds.map(({ id }) => id)).toEqual([
      secondCavern.id,
      planar.id,
      cavern.id,
    ]);
  });
});
