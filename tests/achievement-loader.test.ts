import { beforeEach, expect, it, vi } from "vitest";
import { setBetaEnabled } from "@/data/betaState";

beforeEach(() => vi.resetModules());

it("loads logic and only the selected language, reusing logic when language changes", async () => {
  const { loadAchievementDisplay, loadAchievementLogic } = await import(
    "@/data/achievementLoader"
  );
  const english = await loadAchievementDisplay("en");
  expect(english.achievements).toHaveLength(1950);
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
    "/src/data/game/achievements.json",
    "/src/data/game/achievements_en.json",
  ]);
  const chinese = await loadAchievementDisplay("zh-CN");
  await loadAchievementLogic();
  expect(chinese.achievements.map((entry) => entry.id)).toEqual(
    english.achievements.map((entry) => entry.id)
  );
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch).toHaveBeenLastCalledWith("/src/data/game/achievements_zh.json");
});

it("loads preview logic and the selected preview language only when enabled", async () => {
  setBetaEnabled(true);
  const { loadAchievementDisplay } = await import("@/data/achievementLoader");
  expect((await loadAchievementDisplay("zh-CN")).achievements).toHaveLength(
    1950
  );
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
    "/src/data/game/achievements.json",
    "/src/data/game/achievements_beta.json.gz",
    "/src/data/game/achievements_zh.json",
    "/src/data/game/achievements_beta_zh.json.gz",
  ]);
});

it("retries a failed transport without refetching successful logic", async () => {
  const fixtureFetch = fetch;
  let failed = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("_en.json") && !failed) {
        failed = true;
        return Promise.resolve(new Response(null, { status: 503 }));
      }
      return fixtureFetch(input);
    })
  );
  const { loadAchievementDisplay } = await import("@/data/achievementLoader");
  await expect(loadAchievementDisplay("en")).rejects.toThrow("503");
  expect((await loadAchievementDisplay("en")).achievements).toHaveLength(1950);
  expect(fetch).toHaveBeenCalledTimes(3);
});
