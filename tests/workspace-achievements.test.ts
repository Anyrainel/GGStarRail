import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { parseBackup, serializeBackup } from "@/lib/backup";
import { DEFAULT_WORKSPACE } from "@/stores/schemas";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";

afterEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
});

describe("workspace achievement completion", () => {
  it("persists anonymous chain tracking through hydration and backup", async () => {
    useWorkspaceStore
      .getState()
      .setSeriesAchievementStatus(
        [301, 302, 303],
        302,
        true,
        new Date("2026-09-18T00:00:00.000Z")
      );
    const persisted = localStorage.getItem(STORAGE_KEYS.workspace)!;
    expect(useWorkspaceStore.getState().account).toBeNull();
    useWorkspaceStore.getState().clearWorkspace();
    localStorage.setItem(STORAGE_KEYS.workspace, persisted);
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState().localAchievementCompletion).toEqual({
      completedIds: [301, 302],
      locallyModifiedAt: "2026-09-18T00:00:00.000Z",
    });
    const backup = parseBackup(
      serializeBackup({
        ...structuredClone(DEFAULT_WORKSPACE),
        localAchievementCompletion:
          useWorkspaceStore.getState().localAchievementCompletion,
      })
    );
    useWorkspaceStore.getState().clearWorkspace();
    useWorkspaceStore.getState().replaceWorkspace(backup.payload);
    useWorkspaceStore
      .getState()
      .setSeriesAchievementStatus([301, 302, 303], 301, false);
    expect(
      useWorkspaceStore.getState().localAchievementCompletion.completedIds
    ).toEqual([]);
  });

  it("keeps anonymous progress separate from imported accounts and build imports", () => {
    useWorkspaceStore.getState().setSeriesAchievementStatus([301], 301, true);
    const account = makeAccountSnapshot();
    account.achievementCompletion = { completedIds: [101] };
    useWorkspaceStore.getState().applyAccountImport(account, "replace");
    useWorkspaceStore
      .getState()
      .setSeriesAchievementStatus([101, 102], 102, true);
    expect(
      useWorkspaceStore.getState().account?.achievementCompletion?.completedIds
    ).toEqual([101, 102]);
    expect(
      useWorkspaceStore.getState().localAchievementCompletion.completedIds
    ).toEqual([301]);
    useWorkspaceStore.getState().replaceBuildWorkspace({
      builds: [],
      scoreProfiles: [],
      triageRules: DEFAULT_WORKSPACE.triageRules,
    });
    expect(
      useWorkspaceStore.getState().localAchievementCompletion.completedIds
    ).toEqual([301]);
    useWorkspaceStore.getState().clearWorkspace();
    expect(
      useWorkspaceStore.getState().localAchievementCompletion.completedIds
    ).toEqual([]);
  });

  it("applies series dependencies and retains capture provenance after local edits", () => {
    const account = makeAccountSnapshot();
    account.achievementCompletion = {
      completedIds: [101],
      capture: {
        coverage: "complete",
        source: { kind: "packetCapture", revision: "capture-v1" },
        importedAt: "2026-09-03T00:00:00.000Z",
      },
    };
    useWorkspaceStore.getState().replaceAccount(account);

    useWorkspaceStore
      .getState()
      .setSeriesAchievementStatus(
        [101, 102, 103],
        103,
        true,
        new Date("2026-09-04T01:00:00.000Z")
      );
    expect(useWorkspaceStore.getState().account?.achievementCompletion).toEqual(
      {
        completedIds: [101, 102, 103],
        capture: account.achievementCompletion.capture,
        locallyModifiedAt: "2026-09-04T01:00:00.000Z",
      }
    );

    useWorkspaceStore
      .getState()
      .setSeriesAchievementStatus(
        [101, 102, 103],
        102,
        false,
        new Date("2026-09-04T02:00:00.000Z")
      );
    expect(
      useWorkspaceStore.getState().account?.achievementCompletion?.completedIds
    ).toEqual([101]);
  });

  it("starts local tracking without fabricating capture coverage", () => {
    useWorkspaceStore.getState().replaceAccount(makeAccountSnapshot());

    useWorkspaceStore
      .getState()
      .setSeriesAchievementStatus(
        [201, 202],
        202,
        true,
        new Date("2026-09-04T03:00:00.000Z")
      );

    expect(useWorkspaceStore.getState().account?.achievementCompletion).toEqual(
      {
        completedIds: [201, 202],
        locallyModifiedAt: "2026-09-04T03:00:00.000Z",
      }
    );
  });
});
