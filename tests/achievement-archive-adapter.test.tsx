import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setBetaEnabled } from "@/data/betaState";
import { I18nProvider } from "@/i18n/I18nContext";
import { configureCatalogAssetLookup } from "@/lib/assets";
import { AchievementArchiveContent } from "@/pages/archive/AchievementArchiveContent";
import {
  createAchievementArchiveViewData,
  formatAchievementArchiveText,
} from "@/pages/archive/AchievementArchiveView";
import {
  loadAchievementCategories,
  loadAchievements,
} from "@/providers/gilore/catalog";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";

const runtimeLookupPath = path.resolve(
  "public/assets/ggstarrail/cache/gilore/lookup-v1/runtime-lookup.json"
);

function setDesktopLayout() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(min-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

async function loadRealViewData(
  locale: "en" | "zh-CN",
  dynamicTextFallback: string,
  trailblazerFallback: string
) {
  const [categories, achievements] = await Promise.all([
    loadAchievementCategories(),
    loadAchievements(),
  ]);
  return {
    rawAchievements: achievements.values,
    viewData: createAchievementArchiveViewData(
      categories.values,
      achievements.values,
      locale,
      dynamicTextFallback,
      trailblazerFallback
    ),
  };
}

afterEach(() => {
  useWorkspaceStore.setState({ account: null });
});

describe("achievement archive GIlore adapter", () => {
  beforeEach(() => setBetaEnabled(true));
  it("maps the complete real bilingual 1.2 catalogs without changing visibility", async () => {
    const [english, chinese] = await Promise.all([
      loadRealViewData("en", "[dynamic in-game text]", "Trailblazer"),
      loadRealViewData("zh-CN", "【游戏内动态文本】", "开拓者"),
    ]);

    expect(english.viewData.categories).toHaveLength(9);
    expect(english.viewData.achievements).toHaveLength(1921);
    expect(chinese.viewData.categories).toHaveLength(9);
    expect(chinese.viewData.achievements).toHaveLength(1921);
    expect(
      english.viewData.categories.find((category) => category.id === 1)?.name
    ).toBe("I, Trailblazer");
    expect(
      chinese.viewData.categories.find((category) => category.id === 1)?.name
    ).toBe("我，开拓者");

    expect(
      english.viewData.achievements.filter(
        (achievement) => achievement.visibility === "visible"
      )
    ).toHaveLength(805);
    expect(
      english.viewData.achievements.filter(
        (achievement) => achievement.visibility === "show_after_finish"
      )
    ).toHaveLength(806);
    expect(
      english.viewData.achievements.filter(
        (achievement) => achievement.visibility === "hidden_description"
      )
    ).toHaveLength(310);
  });

  it("formats parameters while replacing only complete TEXTJOIN tokens", () => {
    expect(
      formatAchievementArchiveText(
        "Route #55, target #1%, {TEXTJOIN#87}, {TEXTJOIN#x}, TEXTJOIN#54",
        [66],
        "[dynamic in-game text]",
        "Trailblazer"
      )
    ).toEqual({
      value:
        "Route #55, target 66%, [dynamic in-game text], {TEXTJOIN#x}, TEXTJOIN#54",
      hasDynamicText: true,
    });
  });

  it("uses localized fallbacks for real runtime-dependent achievement text", async () => {
    const [english, chinese] = await Promise.all([
      loadRealViewData("en", "[dynamic in-game text]", "Trailblazer"),
      loadRealViewData("zh-CN", "【游戏内动态文本】", "开拓者"),
    ]);
    const source = english.rawAchievements.find((achievement) =>
      achievement.description.en.value.includes("{TEXTJOIN#")
    );
    if (!source)
      throw new Error("Real achievement TEXTJOIN fixture is missing");

    const englishView = english.viewData.achievements.find(
      (achievement) => achievement.id === source.id
    );
    const chineseView = chinese.viewData.achievements.find(
      (achievement) => achievement.id === source.id
    );
    expect(englishView?.description).toContain("[dynamic in-game text]");
    expect(englishView?.description).not.toMatch(/\{TEXTJOIN#\d+\}/);
    expect(chineseView?.description).toContain("【游戏内动态文本】");
    expect(chineseView?.description).not.toMatch(/\{TEXTJOIN#\d+\}/);
  });

  it("renders the generated Stellar Jade reward image with an accessible name", async () => {
    const { viewData } = await loadRealViewData(
      "en",
      "[dynamic in-game text]",
      "Trailblazer"
    );
    const lookup = JSON.parse(fs.readFileSync(runtimeLookupPath, "utf8")) as {
      entries: Array<[string, string, string | null]>;
    };
    const reward = lookup.entries.find(
      ([kind, id]) => kind === "achievement-reward" && id === "1"
    );
    if (!reward?.[2]) throw new Error("Stellar Jade cache entry is missing");
    configureCatalogAssetLookup([
      {
        kind: "achievement-reward",
        id: reward[1],
        cachePath: reward[2],
      },
    ]);
    const achievement = viewData.achievements.find(
      (candidate) => candidate.visibility === "visible"
    );
    if (!achievement) throw new Error("Visible achievement fixture is missing");
    const category = viewData.categories.find(
      (candidate) => candidate.id === achievement.categoryId
    );
    if (!category) throw new Error("Achievement category fixture is missing");
    const account = makeAccountSnapshot();
    account.achievementCompletion = {
      completedIds: [],
      capture: {
        coverage: "complete",
        source: { kind: "packetCapture", revision: "capture-fixture" },
        importedAt: "2026-09-04T00:00:00.000Z",
      },
    };
    useWorkspaceStore.setState({ account });
    setDesktopLayout();

    render(
      <I18nProvider>
        <AchievementArchiveContent
          categories={[category]}
          achievements={[achievement]}
        />
      </I18nProvider>
    );

    const image = await screen.findByRole("img", { name: "Stellar Jade" });
    expect(image).toHaveAttribute("data-asset-source", "local-cache");
    expect(image).toHaveAttribute("src", expect.stringMatching(/\.png$/));
    expect(image.parentElement).toHaveTextContent(
      String(achievement.rewardCount)
    );
  });
});
