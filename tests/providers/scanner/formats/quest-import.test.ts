import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { applyAccountImport } from "@/domain/game-account/merge";
import { loadAchievementIds } from "@/providers/reference/catalog";
import { loadQuestArchive } from "@/providers/reference/questLoader";
import { parseVersionedScannerExport } from "@/providers/scanner/formats/schema";
import {
  createBackupEnvelope,
  parseBackup,
  serializeBackup,
} from "@/services/backup/workspace";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "../../../fixtures";
import hsrScannerV4Fixture from "../../../fixtures/scanner/hsr-scanner-v4.json";

afterEach(() => useWorkspaceStore.getState().clearWorkspace());

async function fixture() {
  const ids = [...(await loadAchievementIds())].sort((a, b) => a - b);
  const records = [
    { id: 4000001, status: 3, progress: 100, counters: [2, 7] },
    { id: ids[0]!, status: 3, progress: 1, counters: [] },
    { id: ids[1]!, status: 1, progress: 0, counters: [] },
    { id: 4999999, status: 2, progress: 5, counters: [] },
  ].sort((a, b) => a.id - b.id);
  return {
    source: "HSR-Scanner",
    build: "v1.2.0",
    version: 4,
    metadata: { uid: null },
    generator: {
      name: "GOODScanner",
      version: "0.2.0",
      captureRevision: "reliquary-quest-4.6-v2",
    },
    coverage: {
      characters: "unknown",
      lightCones: "unknown",
      relics: "unknown",
    },
    characters: [],
    light_cones: [],
    relics: [],
    quests: { schemaVersion: 1, coverage: "complete", records },
  };
}

describe("complete Quest capture imports", () => {
  it("derives achievements by public membership and preserves every other ID and counter", async () => {
    const input = await fixture();
    const draft = await parseVersionedScannerExport(input);
    expect(draft.account.schemaVersion).toBe(5);
    expect(draft.account.achievementCompletion?.completedIds).toEqual([
      input.quests.records[1]!.id,
    ]);
    expect(draft.account.questProgress?.records).toEqual(input.quests.records);
    const old = makeAccountSnapshot();
    old.questProgress = {
      records: [{ id: 1, status: 1, progress: 0, counters: [] }],
      importedAt: old.source.importedAt,
    };
    const merged = applyAccountImport(old, draft.account, "merge");
    expect(merged.characters).toEqual(old.characters);
    expect(merged.questProgress?.records).toEqual(input.quests.records);
    const inventoryOnly = {
      ...makeAccountSnapshot(),
      profileId: merged.profileId,
    };
    expect(
      applyAccountImport(merged, inventoryOnly, "merge").questProgress
    ).toEqual(merged.questProgress);
    const workspace = { ...DEFAULT_WORKSPACE, account: merged };
    expect(
      parseBackup(serializeBackup(workspace)).payload.account?.questProgress
    ).toEqual(merged.questProgress);
  });

  it("rejects duplicate, unsorted and invalid-status records", async () => {
    const input = await fixture();
    for (const records of [
      [...input.quests.records, input.quests.records[0]!],
      [...input.quests.records].reverse(),
      [{ id: 1, status: 5, progress: 0, counters: [] }],
    ]) {
      await expect(
        parseVersionedScannerExport({
          ...input,
          quests: { ...input.quests, records },
        })
      ).rejects.toThrow();
    }
  });

  it("migrates a realistic v1 persisted workspace/account v3 via hydration and backup", async () => {
    const account = {
      ...(await parseVersionedScannerExport(hsrScannerV4Fixture)).account,
      schemaVersion: 3,
      achievementCompletion: {
        completedIds: [[...(await loadAchievementIds())][0]!],
      },
    };
    const { buildPresetSubscription: _subscription, ...oldFields } =
      structuredClone(DEFAULT_WORKSPACE);
    const old = {
      ...oldFields,
      schemaVersion: 1,
      account,
    };
    localStorage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({ version: 1, state: old })
    );
    await useWorkspaceStore.persist.rehydrate();
    const hydrated = useWorkspaceStore.getState().account;
    expect(hydrated?.schemaVersion).toBe(5);
    expect(hydrated?.characters).toEqual(account.characters);
    expect(hydrated?.achievementCompletion).toEqual(
      account.achievementCompletion
    );
    expect(hydrated?.questProgress).toBeUndefined();
    const envelope = createBackupEnvelope(DEFAULT_WORKSPACE);
    expect(
      parseBackup(JSON.stringify({ ...envelope, payload: old })).payload.account
    ).toEqual(hydrated);
    const native = {
      format: "ggstarrail-scanner-export",
      schemaVersion: 1,
      sourceApp: { name: "GGScanner", version: "old" },
      exportedAt: account.source.importedAt,
      account,
    };
    expect(
      (await parseVersionedScannerExport(native)).account.schemaVersion
    ).toBe(5);
  });

  it("publishes every non-achievement Quest, including untitled and missing-condition rows", async () => {
    const { quests, achievementIds } = await loadQuestArchive();
    expect(quests).toHaveLength(3833);
    expect(quests.every((quest) => !achievementIds.has(quest.id))).toBe(true);
    expect(
      quests.some((quest) => quest.id === 4000001 && quest.name === null)
    ).toBe(true);
    expect(quests.some((quest) => quest.condition === null)).toBe(true);
    expect(new Set(quests.map((quest) => quest.id)).size).toBe(quests.length);
  });
});
