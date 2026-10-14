import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("build controls and toast work at desktop and narrow widths", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("ggstarrail:locale:v1", "zh-CN")
  );
  await page.goto("/builds/configure?character=1102");
  if (testInfo.project.name === "mobile") {
    await page
      .getByRole("banner")
      .getByRole("button", { name: "更多", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "导入", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "导入", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "游戏内置推荐配装", exact: true })
    .click();
  await page.getByRole("button", { name: "订阅预设", exact: true }).click();
  await expect(page.locator("[data-sonner-toast]")).toContainText("已导入");
  const card = page
    .locator('[data-character-build-card="1102"] [data-build-card]')
    .first();
  await expect(card).toBeVisible();
  await expect(
    card.getByRole("textbox", { name: "配装名称", exact: true })
  ).toHaveValue("");
  await expect(card.getByRole("combobox", { name: "最低星魂" })).toHaveText(
    "0魂+"
  );
  await card.getByRole("switch", { name: "启用配装" }).click();
  await expect(card.getByRole("switch")).toHaveAttribute(
    "data-state",
    "unchecked"
  );
  await card.getByRole("switch").click();
  await card.getByRole("button", { name: "定位", exact: true }).click();
  await page.getByRole("checkbox", { name: "输出", exact: true }).check();
  await page.getByRole("checkbox", { name: "辅助", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(
    card.getByRole("button", { name: "定位", exact: true })
  ).toHaveText("输出 / 辅助");
  await card.getByRole("combobox", { name: "最低星魂" }).click();
  await page.getByRole("option", { name: "2魂+", exact: true }).click();
  await page.goto("/builds/configure?character=1102");
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("combobox", { name: "最低星魂" })).toHaveText(
    "2魂+"
  );
  await expect(
    card.getByRole("button", { name: "定位", exact: true })
  ).toHaveText("输出 / 辅助");
  await expect(
    page.locator('[data-character-build-card="1102"] [data-relic-kind-icon]')
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await card.screenshot({ path: testInfo.outputPath("build-controls.png") });
  if (testInfo.project.name === "desktop") {
    const sidebar = page.getByRole("complementary", { name: "角色筛选" });
    const group = sidebar.getByRole("group", { name: "命途", exact: true });
    await expect(group).toBeVisible();
    const columns = await group
      .locator("div.grid")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length
      );
    expect(columns).toBe(2);
    await sidebar.screenshot({ path: testInfo.outputPath("sidebar.png") });
  }
});
