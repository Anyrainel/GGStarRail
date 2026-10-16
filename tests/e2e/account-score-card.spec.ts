import path from "node:path";
import { expect, test } from "@playwright/test";

test("account score details stay in the popup and Light Cones have compact rounded frames", async ({
  page,
}, testInfo) => {
  await page.goto("/account-data/characters");
  await expect(
    page.getByRole("button", { name: "Import game account", exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import game account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("tests/fixtures/scanner/hsr-scanner-v4.json"));
  await dialog
    .getByRole("button", { name: "Apply reviewed data", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.goto("/builds/configure?character=1101");
  await page
    .getByRole("button", { name: "Add Cavern Relic build", exact: true })
    .click();
  await page.goto("/account-data/characters");
  const card = page.getByRole("article", {
    name: "Bronya loadout",
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(
    card.locator("[data-relic-score], [data-relic-markers]")
  ).toHaveCount(0);
  const cone = card.locator(
    '[data-item-icon-kind="light-cone"] [data-item-artwork]'
  );
  const geometry = await cone.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    const image = element.querySelector("img")!.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: frame.width,
      height: frame.height,
      imageWidth: image.width,
      left: image.left - frame.left,
      corners: [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ].map(Number.parseFloat),
    };
  });
  expect(geometry.height / geometry.width).toBeCloseTo((0.9 * 16) / 11, 2);
  expect(geometry.imageWidth / geometry.width).toBeCloseTo(0.9, 1);
  expect(geometry.left / geometry.width).toBeCloseTo(0.05, 1);
  expect(geometry.corners.every((radius) => radius > 0)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("account-card.png"),
    animations: "disabled",
  });
  const trigger = card.getByRole("button", { name: "Relic score breakdown" });
  if (testInfo.project.name === "desktop") {
    await trigger.hover();
    await expect(
      page.getByRole("heading", { name: "Relic score breakdown" })
    ).toBeVisible();
  }
  await trigger.click();
  const heading = page.getByRole("heading", { name: "Relic score breakdown" });
  await expect(heading).toBeVisible();
  const popup = heading.locator("..");
  await popup.locator("summary").first().click();
  await expect(
    popup.locator("details[open]").getByText("Substat score", { exact: true })
  ).toBeVisible();
  const bounds = await popup.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width
  );
  await page.screenshot({
    path: testInfo.outputPath("account-score-popup.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(heading).toBeHidden();
});
