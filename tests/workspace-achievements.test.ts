import { afterEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";

afterEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
});

describe("workspace achievement completion", () => {
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
