import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import {
  createBackupEnvelope,
  parseBackup,
  serializeBackup,
} from "@/lib/backup";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";

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

  it("rejects unsupported workspace versions instead of guessing", () => {
    const backup = createBackupEnvelope(DEFAULT_WORKSPACE);
    for (const version of [0, 3, 4, 5]) {
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
    expect(useWorkspaceStore.getState().schemaVersion).toBe(2);
    expect(useWorkspaceStore.getState().builds).toEqual([]);
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.removeItem(STORAGE_KEYS.workspace);
  });

  it("migrates workspace v1 interoperable trace keys to catalog point IDs", async () => {
    const account = legacyV3Account();
    const persistedV1 = {
      ...structuredClone(DEFAULT_WORKSPACE),
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
    expect(hydrated.schemaVersion).toBe(2);
    expect(hydrated.account?.schemaVersion).toBe(4);
    expect(hydrated.account?.characters[0]?.traces).toEqual(CANONICAL_TRACES);
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.removeItem(STORAGE_KEYS.workspace);

    const backup = createBackupEnvelope(DEFAULT_WORKSPACE);
    const parsed = parseBackup(
      JSON.stringify({ ...backup, payload: persistedV1 })
    );
    expect(parsed.payload.schemaVersion).toBe(2);
    expect(parsed.payload.account?.characters[0]?.traces).toEqual(
      CANONICAL_TRACES
    );
  });
});

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
