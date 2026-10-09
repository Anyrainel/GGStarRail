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

  it("rejects experimental workspace versions instead of migrating backups", () => {
    const backup = createBackupEnvelope(DEFAULT_WORKSPACE);
    for (const version of [2, 3, 4, 5]) {
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
    expect(useWorkspaceStore.getState().schemaVersion).toBe(1);
    expect(useWorkspaceStore.getState().builds).toEqual([]);
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.removeItem(STORAGE_KEYS.workspace);
  });
});
