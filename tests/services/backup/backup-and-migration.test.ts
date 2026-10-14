import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import inGamePreset from "@/config/presets/builds/in-game.json";
import { parseScannerExport } from "@/providers/scanner/formats/schema";
import {
  createBackupEnvelope,
  parseBackup,
  serializeBackup,
} from "@/services/backup/workspace";
import { parseBuildWorkspaceBundle } from "@/services/builds/bundle";
import { DEFAULT_WORKSPACE, WORKSPACE_SCHEMA_VERSION } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "../../fixtures";

describe("independent persistence and backup identity", () => {
  it("round-trips only the GGStarRail envelope", () => {
    const account = makeAccountSnapshot();
    account.achievementCompletion = {
      completedIds: [101, 102],
      capture: {
        coverage: "complete",
        source: { kind: "packetCapture", revision: "capture-v1" },
        importedAt: "2026-09-03T00:00:00.000Z",
      },
    };
    const workspace = {
      ...structuredClone(DEFAULT_WORKSPACE),
      account,
    };
    const serialized = serializeBackup(workspace);
    const parsed = parseBackup(serialized);
    expect(parsed.product).toBe("GGStarRail");
    expect(parsed.kind).toBe("ggstarrail.backup");
    expect(parsed.payload.account?.characters).toHaveLength(1);
    expect(parsed.payload.account?.achievementCompletion?.completedIds).toEqual(
      [101, 102]
    );
    expect(serialized).not.toContain("GenshinTools");
    expect(serialized).not.toContain("GGArtifact");
  });

  it("rejects cross-product and sensitive-shaped payloads", () => {
    const valid = createBackupEnvelope(DEFAULT_WORKSPACE);
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, product: "GenshinTools" }))
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({ ...valid, payload: { ...valid.payload, ltoken: "x" } })
      )
    ).toThrow(/Sensitive field/);
  });

  it("restores a subscribed build file through backup and keeps edits across its next update", async () => {
    const preset = parseBuildWorkspaceBundle(JSON.stringify(inGamePreset));
    const [edited, deleted, untouched] = preset.builds;
    if (!edited || !deleted || !untouched)
      throw new Error("Missing preset fixtures");
    useWorkspaceStore.getState().clearWorkspace();
    useWorkspaceStore.getState().subscribeBuildPreset("in-game", preset);
    useWorkspaceStore
      .getState()
      .upsertBuild({ ...edited, name: "My saved build" });
    useWorkspaceStore.getState().removeBuild(deleted.id);
    const persisted = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.workspace) ?? "null"
    ).state;
    const backup = parseBackup(serializeBackup(persisted));
    useWorkspaceStore.getState().clearWorkspace();
    useWorkspaceStore.getState().replaceWorkspace(backup.payload);
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState().buildPresetSubscription?.presetId).toBe(
      "in-game"
    );
    const update = {
      ...preset,
      builds: preset.builds.map((build) => ({
        ...build,
        name: "Updated preset build",
      })),
    };
    useWorkspaceStore.getState().hydrateBuildPreset("in-game", update);
    const state = useWorkspaceStore.getState();
    expect(state.builds.find((build) => build.id === edited.id)?.name).toBe(
      "My saved build"
    );
    expect(state.builds.some((build) => build.id === deleted.id)).toBe(false);
    expect(state.builds.find((build) => build.id === untouched.id)?.name).toBe(
      "Updated preset build"
    );
    expect(state.buildPresetSubscription?.baseline.builds).toEqual(
      update.builds
    );
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.removeItem(STORAGE_KEYS.workspace);
  });

  it("rejects unsupported workspace versions instead of guessing", () => {
    const backup = createBackupEnvelope(DEFAULT_WORKSPACE);
    for (const version of [0, 6, 7]) {
      expect(() =>
        parseBackup(
          JSON.stringify({
            ...backup,
            payload: { ...backup.payload, schemaVersion: version },
          })
        )
      ).toThrow();
    }
  });

  it("starts empty when hydrating an incompatible experimental workspace", async () => {
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({
        version: 5,
        state: { ...DEFAULT_WORKSPACE, schemaVersion: 5 },
      })
    );
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState().schemaVersion).toBe(
      WORKSPACE_SCHEMA_VERSION
    );
    expect(useWorkspaceStore.getState().builds).toEqual([]);
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.removeItem(STORAGE_KEYS.workspace);
  });

  it.each(["published", "quest-branch"] as const)(
    "preserves %s v4 accounts through hydration, backup and native import",
    async (format) => {
      const legacy = legacyV3Account();
      const questProgress = {
        records: [{ id: 4000001, status: 3, progress: 100, counters: [2, 7] }],
        importedAt: legacy.source.importedAt,
      };
      const account = {
        ...legacy,
        schemaVersion: 4,
        characters:
          format === "published"
            ? legacy.characters.map((character) => ({
                ...character,
                traces: CANONICAL_TRACES,
              }))
            : legacy.characters,
        achievementCompletion: { completedIds: [101, 102] },
        ...(format === "quest-branch" ? { questProgress } : {}),
      };
      const previous = {
        ...historicalWorkspace(),
        schemaVersion: format === "published" ? 2 : 1,
        characterLightConeIds: { "1101": ["20001"] },
        localAchievementCompletion: { completedIds: [103] },
        triageRules: { ...DEFAULT_WORKSPACE.triageRules, keepScoreAtLeast: 77 },
        account,
      };
      useWorkspaceStore.getState().clearWorkspace();
      localStorage.setItem(
        STORAGE_KEYS.workspace,
        JSON.stringify({ version: 2, state: previous })
      );
      await useWorkspaceStore.persist.rehydrate();
      const hydrated = useWorkspaceStore.getState();
      expect(hydrated.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
      expect(hydrated.account).toEqual({
        ...account,
        schemaVersion: 5,
        characters: account.characters.map((character) => ({
          ...character,
          traces: CANONICAL_TRACES,
        })),
      });
      expect(hydrated.characterLightConeIds).toEqual(
        previous.characterLightConeIds
      );
      expect(hydrated.localAchievementCompletion).toEqual(
        previous.localAchievementCompletion
      );
      expect(hydrated.triageRules).toEqual(previous.triageRules);
      const backup = createBackupEnvelope(DEFAULT_WORKSPACE);
      const restored = parseBackup(
        JSON.stringify({ ...backup, payload: previous })
      ).payload;
      expect(restored).toEqual({
        ...previous,
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        buildPresetSubscription: null,
        account: hydrated.account,
      });
      const native = parseScannerExport({
        format: "ggstarrail-scanner-export",
        schemaVersion: 1,
        sourceApp: { name: "GGScanner", version: "old" },
        exportedAt: account.source.importedAt,
        account,
      });
      expect(native.account).toEqual(hydrated.account);
      useWorkspaceStore.getState().clearWorkspace();
      localStorage.removeItem(STORAGE_KEYS.workspace);
    }
  );

  it("migrates workspace v1 interoperable trace keys to catalog point IDs", async () => {
    const account = legacyV3Account();
    const persistedV1 = {
      ...historicalWorkspace(),
      schemaVersion: 1,
      account,
    };

    useWorkspaceStore.getState().clearWorkspace();
    localStorage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({ version: 1, state: persistedV1 })
    );
    await useWorkspaceStore.persist.rehydrate();
    const hydrated = useWorkspaceStore.getState();
    expect(hydrated.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(hydrated.account?.schemaVersion).toBe(5);
    expect(hydrated.account?.characters[0]?.traces).toEqual(CANONICAL_TRACES);
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.removeItem(STORAGE_KEYS.workspace);

    const backup = createBackupEnvelope(DEFAULT_WORKSPACE);
    const parsed = parseBackup(
      JSON.stringify({ ...backup, payload: persistedV1 })
    );
    expect(parsed.payload.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(parsed.payload.account?.characters[0]?.traces).toEqual(
      CANONICAL_TRACES
    );
  });
});

/** Pre-subscription workspace fields, as stored by released v1–v3 clients. */
function historicalWorkspace() {
  const { buildPresetSubscription: _subscription, ...fields } =
    structuredClone(DEFAULT_WORKSPACE);
  return fields;
}

const CANONICAL_TRACES = {
  "1101001": 6,
  "1101002": 10,
  "1101003": 10,
  "1101004": 10,
  "1101301": 5,
  "1101101": 1,
  "1101103": 0,
  "1101202": 1,
  "1101210": 0,
};

/** Account snapshot v3 as persisted by workspace v1 after a v4 file import. */
function legacyV3Account() {
  const account = makeAccountSnapshot();
  const [character] = account.characters;
  if (!character) throw new Error("Missing fixture Character");
  return {
    ...account,
    schemaVersion: 3,
    characters: [
      {
        ...character,
        definitionId: "1101",
        traces: {
          "skill:basic": 6,
          "skill:skill": 10,
          "skill:ult": 10,
          "skill:talent": 10,
          "memosprite:skill": 5,
          "trace:ability_1": 1,
          "trace:ability_3": 0,
          "trace:stat_2": 1,
          "trace:stat_10": 0,
          "source:abilityVersion": 0,
        },
      },
    ],
  };
}
