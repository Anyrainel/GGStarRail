import { describe, expect, it } from "vitest";
import {
  type AchievementArchiveItem,
  achievementCompletionProgress,
  achievementMatchesFilters,
  achievementPresentedText,
  buildAchievementVideoSearchUrl,
  classifyAchievementCompletion,
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
        "  SCARLET   clockwork ",
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

  it("does not let search reveal show-after-finish reference text", () => {
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
    ).toBe(false);
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

  it("does not infer unfinished state when completion coverage is unknown", () => {
    expect(
      achievementMatchesFilters(
        hidden,
        "",
        new Set(["finished"]),
        new Set(),
        null
      )
    ).toBe(true);
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
});

describe("achievement series and completion", () => {
  it("groups by the authoritative chain and orders visible steps by chain index", () => {
    const chain = [20, 10, 30];
    const grouped = groupAchievementSeries([
      achievement(10, { chainIds: chain, chainIndex: 1, order: 100 }),
      achievement(40),
      achievement(30, { chainIds: chain, chainIndex: 2, order: 110 }),
      achievement(20, { chainIds: chain, chainIndex: 0, order: 90 }),
    ]);

    expect(grouped.map((group) => group.items.map((item) => item.id))).toEqual([
      [20, 10, 30],
      [40],
    ]);
    expect(grouped[0]?.seriesIds).toEqual(chain);
  });

  it("keeps unknown completion distinct from a captured known-zero result", () => {
    const items = [achievement(1), achievement(2)];
    expect(achievementCompletionProgress(items, null)).toBeNull();
    expect(achievementCompletionProgress(items, new Set())).toEqual({
      completed: 0,
      total: 2,
      percentage: 0,
    });
  });

  it("distinguishes capture, capture plus edits, and manual provenance", () => {
    expect(classifyAchievementCompletion(false, undefined)).toBe("no-account");
    expect(classifyAchievementCompletion(true, undefined)).toBe(
      "available-to-track"
    );
    expect(classifyAchievementCompletion(true, { completedIds: [] })).toBe(
      "manual"
    );
    expect(
      classifyAchievementCompletion(true, {
        completedIds: [],
        capture: {},
      })
    ).toBe("captured");
    expect(
      classifyAchievementCompletion(true, {
        completedIds: [],
        capture: {},
        locallyModifiedAt: "2026-09-04T00:00:00.000Z",
      })
    ).toBe("captured-edited");
  });

  it("applies the three producer visibility modes exactly", () => {
    const visible = achievement(1);
    const showAfterFinish = achievement(2, {
      name: "True title",
      description: "True description",
      hiddenDescription: "Must not leak either",
      visibility: "show_after_finish",
    });
    const hiddenDescription = achievement(3, {
      description: "Finished description",
      hiddenDescription: "Unfinished hint",
      visibility: "hidden_description",
    });

    expect(achievementPresentedText(visible, false)).toMatchObject({
      name: visible.name,
      description: visible.description,
      descriptionSource: "normal",
    });
    expect(achievementPresentedText(showAfterFinish, false)).toEqual({
      name: null,
      description: null,
      concealed: true,
      descriptionSource: "concealed",
    });
    expect(achievementPresentedText(showAfterFinish, true)).toMatchObject({
      name: "True title",
      description: "True description",
      descriptionSource: "normal",
    });
    expect(achievementPresentedText(hiddenDescription, false)).toMatchObject({
      name: hiddenDescription.name,
      description: "Unfinished hint",
      descriptionSource: "hidden",
    });
    expect(achievementPresentedText(hiddenDescription, true)).toMatchObject({
      description: "Finished description",
      descriptionSource: "normal",
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
