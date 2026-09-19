import { describe, expect, it } from "vitest";
import {
  type AchievementArchiveItem,
  achievementCompletionProgress,
  achievementMatchesFilters,
  achievementVersionFilterValue,
  buildAchievementVideoSearchUrl,
  deriveAchievementVersionFilters,
  groupAchievementSeries,
  UNKNOWN_ACHIEVEMENT_VERSION,
} from "@/domain/achievements";

function achievement(
  id: number,
  overrides: Partial<AchievementArchiveItem> = {}
): AchievementArchiveItem {
  return {
    id,
    categoryId: 1,
    name: `Achievement ${id}`,
    description: `Description ${id}`,
    hiddenDescription: null,
    order: 100 - id,
    releaseVersion: "3.4",
    visibility: "visible",
    chainIds: [id],
    chainIndex: 0,
    ...overrides,
  };
}

describe("achievement archive filtering", () => {
  const hidden = achievement(2, {
    name: "Clockwork Dreams",
    description: "Reach the final room.",
    hiddenDescription: "Find the scarlet secret.",
    visibility: "hidden_description",
  });

  it("uses whitespace-token AND search across item reference text", () => {
    expect(
      achievementMatchesFilters(
        hidden,
        "  FINAL   clockwork ",
        new Set(),
        new Set(),
        new Set()
      )
    ).toBe(true);
    expect(
      achievementMatchesFilters(
        hidden,
        "scarlet station",
        new Set(),
        new Set(),
        new Set()
      )
    ).toBe(false);
  });

  it("searches the real text of hidden achievements before and after completion", () => {
    const concealed = achievement(9, {
      name: "Secret Finale",
      description: "Witness the last scene.",
      hiddenDescription: "A decoy description.",
      visibility: "show_after_finish",
    });

    expect(
      achievementMatchesFilters(
        concealed,
        "secret finale",
        new Set(),
        new Set(),
        new Set()
      )
    ).toBe(true);
    expect(
      achievementMatchesFilters(
        concealed,
        "secret finale",
        new Set(),
        new Set(),
        new Set([concealed.id])
      )
    ).toBe(true);
  });

  it("lets active item search override contradictory chips", () => {
    expect(
      achievementMatchesFilters(
        hidden,
        "final dreams",
        new Set(["unfinished"]),
        new Set(["4"]),
        new Set([hidden.id])
      )
    ).toBe(true);
  });

  it("applies status and major-version chips at item level", () => {
    expect(
      achievementMatchesFilters(
        hidden,
        " \t ",
        new Set(["finished"]),
        new Set(["3"]),
        new Set([hidden.id])
      )
    ).toBe(true);
    expect(
      achievementMatchesFilters(
        hidden,
        "",
        new Set(["unfinished"]),
        new Set(["3"]),
        new Set([hidden.id])
      )
    ).toBe(false);
  });

  it("filters an empty manual checklist as unfinished", () => {
    expect(
      achievementMatchesFilters(
        hidden,
        "",
        new Set(["finished"]),
        new Set(),
        new Set()
      )
    ).toBe(false);
  });

  it("derives major versions and preserves an explicit unknown bucket", () => {
    expect(
      deriveAchievementVersionFilters([
        achievement(1, { releaseVersion: "4.1" }),
        achievement(2, { releaseVersion: "3.7" }),
        achievement(3, { releaseVersion: "4.2" }),
        achievement(4, { releaseVersion: null }),
        achievement(5, { releaseVersion: "unverified" }),
      ])
    ).toEqual(["3", "4", UNKNOWN_ACHIEVEMENT_VERSION]);

    expect(
      achievementMatchesFilters(
        achievement(8, { releaseVersion: null }),
        "",
        new Set(),
        new Set([UNKNOWN_ACHIEVEMENT_VERSION]),
        new Set()
      )
    ).toBe(true);
  });

  it("accepts full numeric release versions and rejects partial or malformed versions", () => {
    expect(achievementVersionFilterValue(" 4.10.2 ")).toBe("4");
    expect(achievementVersionFilterValue("10.0")).toBe("10");
    for (const version of [
      null,
      "",
      "unknown",
      "4.beta",
      "4..1",
      "4.1-preview",
    ]) {
      expect(achievementVersionFilterValue(version)).toBe(
        UNKNOWN_ACHIEVEMENT_VERSION
      );
    }
  });
});

describe("achievement series and completion", () => {
  it("groups adjacent chain members in game-priority order while retaining completion dependencies", () => {
    const chain = [20, 10, 30];
    const grouped = groupAchievementSeries([
      achievement(10, { chainIds: chain, chainIndex: 1, order: 100 }),
      achievement(40),
      achievement(30, { chainIds: chain, chainIndex: 2, order: 110 }),
      achievement(20, { chainIds: chain, chainIndex: 0, order: 90 }),
    ]);

    expect(grouped.map((group) => group.items.map((item) => item.id))).toEqual([
      [30, 10, 20],
      [40],
    ]);
    expect(grouped[0]?.seriesIds).toEqual(chain);
  });

  it("sorts releases numerically before game priority and splits chains across intervening rows", () => {
    const chain = [20, 10, 30];
    const items = [
      achievement(20, {
        chainIds: chain,
        chainIndex: 0,
        releaseVersion: null,
        order: 9999,
      }),
      achievement(10, {
        chainIds: chain,
        chainIndex: 1,
        releaseVersion: "2.7",
        order: 9000,
      }),
      achievement(40, { releaseVersion: "4.2", order: 500 }),
      achievement(30, {
        chainIds: chain,
        chainIndex: 2,
        releaseVersion: "4.10",
        order: 1,
      }),
      achievement(50, { releaseVersion: "4.10.0", order: 8 }),
      achievement(60, { releaseVersion: "4.10", order: 8 }),
      achievement(70, { releaseVersion: "unverified", order: 9998 }),
    ];
    const grouped = groupAchievementSeries(items);
    expect(
      grouped.flatMap((group) => group.items.map((item) => item.id))
    ).toEqual([50, 60, 30, 40, 10, 20, 70]);
    expect(
      grouped
        .filter((group) => group.seriesIds.length === 3)
        .map((group) => group.seriesIds)
    ).toEqual([chain, chain]);
    expect(items[0]?.id).toBe(20);
    // Filtering out a newer chain member cannot raise its older displayed member.
    expect(
      groupAchievementSeries(
        items.filter((item) => [10, 40].includes(item.id))
      ).flatMap((group) => group.items.map((item) => item.id))
    ).toEqual([40, 10]);
  });

  it("counts completion from an empty or partly completed checklist", () => {
    const items = [achievement(1), achievement(2)];
    expect(achievementCompletionProgress(items, new Set())).toEqual({
      completed: 0,
      total: 2,
      percentage: 0,
    });
    expect(achievementCompletionProgress(items, new Set([2]))).toEqual({
      completed: 1,
      total: 2,
      percentage: 50,
    });
  });
});

describe("achievement guide searches", () => {
  it("uses the localized HSR product name", () => {
    expect(buildAchievementVideoSearchUrl("youtube", "Clockwork", "en")).toBe(
      "https://www.youtube.com/results?search_query=Clockwork%20Honkai%3A%20Star%20Rail"
    );
    expect(buildAchievementVideoSearchUrl("bilibili", "钟表", "zh-CN")).toBe(
      "https://search.bilibili.com/all?keyword=%E9%92%9F%E8%A1%A8%20%E5%B4%A9%E5%9D%8F%EF%BC%9A%E6%98%9F%E7%A9%B9%E9%93%81%E9%81%93"
    );
  });
});
