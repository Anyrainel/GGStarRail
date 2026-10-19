import { expect, type Locator, type Page, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

async function expectDialogInViewport(dialog: Locator, page: Page) {
  await expect
    .poll(async () => {
      const bounds = await dialog.boundingBox();
      const viewport = page.viewportSize()!;
      return bounds
        ? Math.max(
            0,
            -bounds.x,
            -bounds.y,
            bounds.x + bounds.width - viewport.width,
            bounds.y + bounds.height - viewport.height
          )
        : Infinity;
    })
    .toBeLessThanOrEqual(1);
}

test("first visit reviews six-slot presets before subscribing and remembers dismissal", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const guide = page.getByRole("dialog", { name: "Choose your Relic builds" });
  await expect(guide).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Latest update" })).toHaveCount(
    0
  );
  expect(
    await page.evaluate(() => localStorage.getItem("ggstarrail:workspace:v1"))
  ).toBeNull();
  await guide.getByRole("button", { name: "Review preset" }).click();
  await expect(
    guide.getByRole("button", { name: "Subscribe to preset" })
  ).toBeVisible();
  await expect(guide.getByText("Cavern Relics · 4 slots")).toBeVisible();
  await expect(guide.getByText("Planar Ornaments · 2 slots")).toBeVisible();
  await expectDialogInViewport(guide, page);
  await page.screenshot({
    path: testInfo.outputPath("startup-preset-review.png"),
  });
  expect(
    await page.evaluate(() => localStorage.getItem("ggstarrail:workspace:v1"))
  ).toBeNull();
  await guide.getByRole("button", { name: "Subscribe to preset" }).click();
  await expect(guide).toBeHidden();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ggstarrail:workspace:v1")!).state
  );
  expect(saved.buildPresetSubscription.presetId).toBe("in-game");
  expect(
    saved.builds.some(
      (build: { category: string }) => build.category === "cavern"
    )
  ).toBe(true);
  expect(
    saved.builds.some(
      (build: { category: string }) => build.category === "planar"
    )
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "GGArtifact", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("latest update opens automatically and complete history stays a side sheet", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("ggstarrail:greeting:v1")) {
      localStorage.setItem(
        "ggstarrail:greeting:v1",
        JSON.stringify({
          version: 1,
          state: { buildPromptSeen: true, lastSeenUpdate: "2026-01-01" },
        })
      );
    }
  });
  await page.goto("/");
  const news = page.getByRole("dialog", { name: "Latest update" });
  await expect(news).toBeVisible();
  await expect(news.locator("time")).toHaveCount(1);
  await expect(news.locator("time")).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  await expectDialogInViewport(news, page);
  await page.screenshot({
    path: testInfo.outputPath("startup-latest-update.png"),
  });
  await news.getByRole("button", { name: "Full update history" }).click();
  await expect(news).toHaveCount(0);
  const history = page.getByRole("dialog", { name: "What’s New" });
  await expect(history).toBeVisible();
  await expect(history.locator("time").nth(1)).toBeAttached();
  await expect
    .poll(async () => {
      const bounds = await history.boundingBox();
      return bounds ? bounds.x + bounds.width : null;
    })
    .toBeCloseTo(page.viewportSize()!.width, -1);
  await history.getByRole("button", { name: "Close", exact: true }).click();
  await expect(history).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "GGArtifact", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
