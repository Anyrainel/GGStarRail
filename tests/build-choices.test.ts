import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { parseBackup, serializeBackup } from "@/lib/backup";
import {
  parseBuildWorkspaceBundle,
  serializeBuildWorkspaceBundle,
} from "@/lib/buildBundle";
import { loadBuildReferences } from "@/lib/buildReferences";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

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
    "Original score",
    "score:original"
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
    "Original",
    "build:original"
  );
  const cone = references.lightCones.values.find(
    (cone) => cone.path_id === character.path_id
  )!;
  return { character, profile, build, cone };
}

describe("Character build choices", () => {
  it("keeps Light Cone choices through hydration, backup, and build export/import", async () => {
    const { character, cone } = await fixture();
    useWorkspaceStore
      .getState()
      .setCharacterLightCones(character.id, [cone.id]);
    const persisted = localStorage.getItem(STORAGE_KEYS.workspace)!;
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.setItem(STORAGE_KEYS.workspace, persisted);
    await useWorkspaceStore.persist.rehydrate();
    const workspace = {
      ...DEFAULT_WORKSPACE,
      characterLightConeIds: useWorkspaceStore.getState().characterLightConeIds,
    };
    expect(
      parseBackup(serializeBackup(workspace)).payload.characterLightConeIds
    ).toEqual({ [character.id]: [cone.id] });
    const bundle = parseBuildWorkspaceBundle(
      serializeBuildWorkspaceBundle({
        builds: [],
        scoreProfiles: [],
        triageRules: workspace.triageRules,
        characterLightConeIds: workspace.characterLightConeIds,
      })
    );
    useWorkspaceStore.getState().clearWorkspace();
    useWorkspaceStore.getState().replaceBuildWorkspace(bundle);
    expect(useWorkspaceStore.getState().characterLightConeIds).toEqual({
      [character.id]: [cone.id],
    });
    expect(bundle.schemaVersion).toBe(1);
  });

  it("duplicates an independent profile and reorders only the Character's builds", async () => {
    const { build, profile } = await fixture();
    const other = {
      ...build,
      id: "build:other",
      characterDefinitionId: "other-character",
    };
    useWorkspaceStore.getState().replaceBuildWorkspace({
      builds: [build, other],
      scoreProfiles: [profile],
      triageRules: DEFAULT_WORKSPACE.triageRules,
    });
    useWorkspaceStore.getState().duplicateBuild(build.id, "Copy");
    const copy = useWorkspaceStore.getState().builds[1]!;
    expect(copy.scoreProfileId).not.toBe(profile.id);
    const copyProfile = useWorkspaceStore
      .getState()
      .scoreProfiles.find((entry) => entry.id === copy.scoreProfileId)!;
    useWorkspaceStore.getState().upsertScoreProfile({
      ...copyProfile,
      statWeights: { ...copyProfile.statWeights, AttackDelta: 0 },
    });
    expect(useWorkspaceStore.getState().scoreProfiles[0]).toEqual(profile);
    useWorkspaceStore.getState().moveBuild(copy.id, "up");
    expect(
      useWorkspaceStore.getState().builds.map((entry) => entry.id)
    ).toEqual([copy.id, build.id, other.id]);
    useWorkspaceStore.getState().moveBuild(copy.id, "up");
    expect(useWorkspaceStore.getState().builds[0]?.id).toBe(copy.id);
  });

  it("rejects duplicate Light Cone choices and more than five slots", () => {
    expect(() =>
      useWorkspaceStore
        .getState()
        .setCharacterLightCones("1001", ["cone", "cone"])
    ).toThrow();
    expect(() =>
      useWorkspaceStore
        .getState()
        .setCharacterLightCones("1001", ["1", "2", "3", "4", "5", "6"])
    ).toThrow();
    expect(useWorkspaceStore.getState().characterLightConeIds).toEqual({});
  });
});
