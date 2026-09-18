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
      cavern: {
        mode: "four-piece",
        setId: references.relicSets.values.find(
          (set) => set.kind === "cavern_relic"
        )!.id,
      },
      planarSetId: references.relicSets.values.find(
        (set) => set.kind === "planar_ornament"
      )!.id,
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
    expect(bundle.schemaVersion).toBe(2);
  });

  it("hydrates a v3 workspace and imports its backup without changing saved builds", async () => {
    const { build, profile } = await fixture();
    const old = {
      schemaVersion: 3,
      account: null,
      builds: [build],
      scoreProfiles: [profile],
      triageRules: DEFAULT_WORKSPACE.triageRules,
    };
    localStorage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({ version: 3, state: old })
    );
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState().builds).toEqual([build]);
    expect(useWorkspaceStore.getState().characterLightConeIds).toEqual({});
    const parsed = parseBackup(
      JSON.stringify({
        product: "GGStarRail",
        kind: "ggstarrail.backup",
        schemaVersion: 1,
        createdAt: "2026-09-18T00:00:00.000Z",
        payload: old,
      })
    );
    expect(parsed.payload).toEqual({
      ...old,
      schemaVersion: 4,
      characterLightConeIds: {},
    });
    const bundle = parseBuildWorkspaceBundle(
      JSON.stringify({
        schema: "ggstarrail.build-workspace",
        schemaVersion: 1,
        exportedAt: "2026-09-18T00:00:00.000Z",
        builds: [build],
        scoreProfiles: [profile],
        triageRules: old.triageRules,
      })
    );
    expect(bundle.builds).toEqual([build]);
    expect(bundle.characterLightConeIds).toEqual({});
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
