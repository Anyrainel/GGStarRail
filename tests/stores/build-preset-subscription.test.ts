import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { BuildPresetSubscriptionSchema } from "@/domain/build/presetSubscription";
import {
  parseBuildWorkspaceBundle,
  serializeBuildWorkspaceBundle,
} from "@/services/builds/bundle";
import { loadInGameBuildPreset } from "@/services/builds/presets";
import { DEFAULT_WORKSPACE, WORKSPACE_SCHEMA_VERSION } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

afterEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
  localStorage.removeItem(STORAGE_KEYS.workspace);
});

describe("build preset subscription", () => {
  it("keeps an inserted duplicate beside its original after hydration and upstream reordering", async () => {
    const preset = await loadInGameBuildPreset();
    const first = preset.builds[0];
    if (!first) throw new Error("Missing preset card");
    const store = useWorkspaceStore.getState();
    store.subscribeBuildPreset("in-game", preset);
    store.duplicateBuild(first.id, "My duplicate");
    const saved = localStorage.getItem(STORAGE_KEYS.workspace)!;
    store.clearWorkspace();
    localStorage.setItem(STORAGE_KEYS.workspace, saved);
    await useWorkspaceStore.persist.rehydrate();
    const authoredOrder = useWorkspaceStore
      .getState()
      .builds.map((build) => build.id);
    const next = structuredClone(preset);
    next.builds.reverse();
    useWorkspaceStore.getState().hydrateBuildPreset("in-game", next);
    expect(
      useWorkspaceStore.getState().builds.map((build) => build.id)
    ).toEqual(authoredOrder);
    expect(useWorkspaceStore.getState().builds[1]?.name).toBe("My duplicate");
  });
  it("follows upstream order until the user reorders cards", async () => {
    const preset = await loadInGameBuildPreset();
    const next = structuredClone(preset);
    next.builds.reverse();
    const store = useWorkspaceStore.getState();
    store.subscribeBuildPreset("in-game", preset);
    store.hydrateBuildPreset("in-game", next);
    expect(
      useWorkspaceStore.getState().builds.map((build) => build.id)
    ).toEqual(next.builds.map((build) => build.id));
    store.subscribeBuildPreset("in-game", preset);
    const reordered = [...preset.builds];
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    useWorkspaceStore.setState({ builds: reordered });
    store.hydrateBuildPreset("in-game", next);
    expect(
      useWorkspaceStore.getState().builds.map((build) => build.id)
    ).toEqual(reordered.map((build) => build.id));
  });

  it("preserves a duplicated card next to its original through reload and upstream reorder", async () => {
    const preset = await loadInGameBuildPreset();
    const store = useWorkspaceStore.getState();
    store.subscribeBuildPreset("in-game", preset);
    store.duplicateBuild(preset.builds[0]!.id, "My adjacent card");
    const order = useWorkspaceStore.getState().builds.map((build) => build.id);
    expect(useWorkspaceStore.getState().builds[1]!.name).toBe(
      "My adjacent card"
    );
    await useWorkspaceStore.persist.rehydrate();
    const next = structuredClone(preset);
    next.builds.reverse();
    store.hydrateBuildPreset("in-game", next);
    expect(
      useWorkspaceStore.getState().builds.map((build) => build.id)
    ).toEqual(order);
  });

  it("rejects duplicate entries, orphan profiles and duplicate tombstones in imported baselines", async () => {
    const preset = await loadInGameBuildPreset();
    useWorkspaceStore.getState().subscribeBuildPreset("in-game", preset);
    const subscription = structuredClone(
      useWorkspaceStore.getState().buildPresetSubscription!
    );
    subscription.baseline.builds.push(subscription.baseline.builds[0]!);
    expect(BuildPresetSubscriptionSchema.safeParse(subscription).success).toBe(
      false
    );
    subscription.baseline.builds.pop();
    subscription.baseline.scoreProfiles = [];
    expect(BuildPresetSubscriptionSchema.safeParse(subscription).success).toBe(
      false
    );
    subscription.baseline.scoreProfiles = preset.scoreProfiles;
    subscription.deletedBuildIds = ["build:deleted", "build:deleted"];
    expect(BuildPresetSubscriptionSchema.safeParse(subscription).success).toBe(
      false
    );
  });
  it("hydrates a realistic v3 local workspace without changing saved builds", async () => {
    const bundle = await loadInGameBuildPreset();
    const old = {
      ...structuredClone(DEFAULT_WORKSPACE),
      schemaVersion: 3,
      builds: bundle.builds,
      scoreProfiles: bundle.scoreProfiles,
      characterLightConeIds: bundle.characterLightConeIds,
    };
    const { buildPresetSubscription: _subscription, ...v3 } = old;
    localStorage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({ version: 3, state: v3 })
    );
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState().schemaVersion).toBe(
      WORKSPACE_SCHEMA_VERSION
    );
    expect(useWorkspaceStore.getState().buildPresetSubscription).toBeNull();
    expect(useWorkspaceStore.getState().builds).toEqual(bundle.builds);
  });

  it("keeps edits, deletions and additions across persisted preset updates and exports", async () => {
    const base = await loadInGameBuildPreset();
    const store = useWorkspaceStore.getState();
    store.subscribeBuildPreset("in-game", base);
    const edited = { ...base.builds[0]!, name: "My edited card" };
    const deleted = base.builds[1]!;
    store.upsertBuild(edited);
    store.removeBuild(deleted.id);
    store.upsertBuild({ ...base.builds[2]!, id: "build:custom" });
    const coneId = Object.keys(base.characterLightConeIds)[0]!;
    store.setCharacterLightCones(coneId, []);
    const profile = base.scoreProfiles[0]!;
    store.upsertScoreProfile({
      ...profile,
      statWeights: { ...profile.statWeights, SpeedDelta: 0.123 },
    });
    await useWorkspaceStore.persist.rehydrate();
    const next = structuredClone(base);
    next.builds[0]!.name = "Upstream edited card";
    next.builds[2]!.name = "Upstream untouched card";
    next.builds.push({ ...base.builds[2]!, id: "build:new-upstream" });
    next.scoreProfiles[0]!.statWeights.SpeedDelta = 0.456;
    useWorkspaceStore.getState().hydrateBuildPreset("in-game", next);
    const current = useWorkspaceStore.getState();
    expect(current.builds.find((build) => build.id === edited.id)?.name).toBe(
      "My edited card"
    );
    expect(current.builds.some((build) => build.id === deleted.id)).toBe(false);
    expect(
      current.builds.find((build) => build.id === base.builds[2]!.id)?.name
    ).toBe("Upstream untouched card");
    expect(current.builds.some((build) => build.id === "build:custom")).toBe(
      true
    );
    expect(
      current.builds.some((build) => build.id === "build:new-upstream")
    ).toBe(true);
    expect(
      current.scoreProfiles.find((value) => value.id === profile.id)
        ?.statWeights.SpeedDelta
    ).toBe(0.123);
    expect(current.characterLightConeIds[coneId]).toEqual([]);
    const exported = parseBuildWorkspaceBundle(
      serializeBuildWorkspaceBundle({
        builds: current.builds,
        scoreProfiles: current.scoreProfiles,
        characterLightConeIds: current.characterLightConeIds,
        triageRules: current.triageRules,
        buildPresetSubscription: current.buildPresetSubscription,
      })
    );
    current.replaceBuildWorkspace(exported);
    expect(
      useWorkspaceStore.getState().buildPresetSubscription?.deletedBuildIds
    ).toContain(deleted.id);
    const withoutDeleted = structuredClone(next);
    withoutDeleted.builds = withoutDeleted.builds.filter(
      (build) => build.id !== deleted.id
    );
    useWorkspaceStore.getState().hydrateBuildPreset("in-game", withoutDeleted);
    useWorkspaceStore.getState().hydrateBuildPreset("in-game", next);
    expect(
      useWorkspaceStore
        .getState()
        .builds.some((build) => build.id === deleted.id)
    ).toBe(false);
  });
});
