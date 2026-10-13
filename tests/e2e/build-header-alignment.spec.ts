import path from "node:path";
import { expect, test } from "@playwright/test";

for (const locale of ["en", "zh-CN"] as const) {
  for (const width of [320, 768, 1280]) {
    test(`build Light Cones stay right anchored: ${locale} ${width}`, async ({
      browser,
    }, testInfo) => {
      for (const ids of [[], ["20000", "20007", "20014", "21003", "21010"]]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
        });
        const page = await context.newPage();
        await page.addInitScript((language) => {
          localStorage.setItem("ggstarrail:locale:v1", language);
        }, locale);
        await page.addInitScript((choices) => {
          localStorage.setItem(
            "ggstarrail:workspace:v1",
            JSON.stringify({
              version: 3,
              state: {
                schemaVersion: 3,
                account: null,
                characterLightConeIds: { "1102": choices },
                localAchievementCompletion: { completedIds: [] },
                builds: [],
                scoreProfiles: [],
                triageRules: {
                  keepScoreAtLeast: 40,
                  reviewScoreAtLeast: 20,
                  protectLocked: true,
                  protectEquipped: true,
                },
              },
            })
          );
        }, ids);
        await page.goto("/builds/configure?character=1102");
        const row = page.locator(
          '[data-character-build-card="1102"] [data-character-build-header]'
        );
        const cones = row.locator("[data-character-light-cones]");
        await expect(cones).toBeVisible();
        await expect(cones.locator("button")).toHaveCount(
          ids.length ? (width < 768 ? 1 : width < 1024 ? 3 : 5) : 1
        );
        const geometry = await row.evaluate((element) => {
          const rowRect = element.getBoundingClientRect();
          const parent = element.parentElement!;
          const parentRect = parent.getBoundingClientRect();
          const style = getComputedStyle(parent);
          const rightAnchor =
            parentRect.right - Number.parseFloat(style.paddingRight);
          const coneRect = element
            .querySelector("[data-character-light-cones]")!
            .getBoundingClientRect();
          return {
            rowRightGap: rightAnchor - rowRect.right,
            coneRightGap: rightAnchor - coneRect.right,
            coneLeft: coneRect.left,
            rowLeft: rowRect.left,
            rowWidth: rowRect.width,
          };
        });
        // Real layout geometry catches a shrink-wrapped row even when its
        // internal flex child has flex:1. Both row and controls must reach
        // the padded CardHeader right edge.
        expect(Math.abs(geometry.rowRightGap)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.coneRightGap)).toBeLessThanOrEqual(1);
        expect(geometry.coneLeft).toBeGreaterThan(geometry.rowLeft);
        expect(geometry.rowWidth).toBeGreaterThan(200);
        await page.screenshot({
          path: testInfo.outputPath(
            `header-${ids.length ? "five" : "empty"}.png`
          ),
          animations: "disabled",
        });
        await context.close();
      }
    });
  }
}

test("account loadout recommendation badges reach the header right edge", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/account-data/characters");
  await page
    .getByRole("button", { name: "Import account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("tests/fixtures/scanner/hsr-scanner-v4.json"));
  await expect(
    dialog.getByText("Review before import", { exact: true })
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Apply reviewed data", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.goto("/builds/configure?character=1101");
  await page
    .getByRole("button", { name: "Add Cavern Relic build", exact: true })
    .click();
  await page.goto("/builds/filters");
  const recommendation = page.locator("[data-filter-loadout]");
  await expect(recommendation).toBeVisible();
  for (const locale of ["en", "zh-CN"]) {
    await page.evaluate(
      (language) => localStorage.setItem("ggstarrail:locale:v1", language),
      locale
    );
    await page.reload();
    await expect(recommendation).toBeVisible();
    const gap = await recommendation
      .locator('[data-slot="card-header"]')
      .evaluate((header) => {
        const edge =
          header.getBoundingClientRect().right -
          Number.parseFloat(getComputedStyle(header).paddingRight);
        const badges = header.firstElementChild!.lastElementChild!;
        return edge - badges.getBoundingClientRect().right;
      });
    expect(Math.abs(gap)).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath(`recommendation-${locale}.png`),
      animations: "disabled",
    });
  }
});

for (const locale of ["en", "zh-CN"]) {
  test(`long character name cannot overlap the Light Cone at 320: ${locale}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.addInitScript(
      (language) => localStorage.setItem("ggstarrail:locale:v1", language),
      locale
    );
    await page.goto("/builds/configure?character=1213");
    const row = page.locator(
      '[data-character-build-card="1213"] [data-character-build-header]'
    );
    await expect(row).toBeVisible();
    const title = row.locator("h2");
    await expect(title).toHaveCSS("text-overflow", "ellipsis");
    const geometry = await row.evaluate((element) => ({
      titleRight: element.querySelector("h2")!.getBoundingClientRect().right,
      coneLeft: element
        .querySelector("[data-character-light-cones]")!
        .getBoundingClientRect().left,
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(geometry.titleRight).toBeLessThanOrEqual(geometry.coneLeft);
    expect(geometry.content).toBeLessThanOrEqual(geometry.viewport + 1);
    await page.screenshot({
      path: testInfo.outputPath("long-character.png"),
      animations: "disabled",
    });
  });
}
