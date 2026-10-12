import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const themes = [
  ["astral", "Herta Space Station"],
  ["express", "Astral Express"],
  ["dreamscape", "Penacony"],
  ["jarilo", "Jarilo-VI"],
  ["luofu", "Xianzhou Luofu"],
  ["amphoreus", "Amphoreus"],
] as const;

function collectBundleFailures(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      ["script", "stylesheet"].includes(response.request().resourceType())
    )
      errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

async function openPreference(page: Page, name: "Theme" | "Language") {
  const direct = page.getByRole("button", { name, exact: true });
  if (await direct.isVisible()) {
    await direct.click();
  } else {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).hover();
  }
}

async function expectResponsiveShell(page: Page) {
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("margin", "0px");
  await expect(page.locator("body")).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)"
  );
  expect(
    await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    }))
  ).toEqual(expect.objectContaining({ width: page.viewportSize()?.width }));
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("built route chunks, theme controls and locale survive reload on both layouts", async ({
  page,
}, testInfo) => {
  const errors = collectBundleFailures(page);
  await page.goto("/");
  await expectResponsiveShell(page);
  const backgrounds = new Set<string>();
  for (const [id, label] of themes) {
    await openPreference(page, "Theme");
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await expectResponsiveShell(page);
    backgrounds.add(
      await page
        .locator("body")
        .evaluate((body) => getComputedStyle(body).backgroundColor)
    );
    const screenshot = testInfo.outputPath(`theme-${id}.png`);
    await page.screenshot({ path: screenshot, animations: "disabled" });
    await testInfo.attach(`theme-${id}`, {
      path: screenshot,
      contentType: "image/png",
    });
  }
  expect(backgrounds.size).toBeGreaterThan(1);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "amphoreus");

  for (const route of [
    "/account-data/characters",
    "/account-data/inventory",
    "/builds/configure",
    "/team-damage/optimizer",
    "/archive/characters",
    "/download-scanner",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expectResponsiveShell(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "amphoreus"
    );
  }
  await openPreference(page, "Language");
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(errors).toEqual([]);
});

test("scanner v4 file crosses upload, review, apply and persisted hydration boundaries", async ({
  page,
}) => {
  const errors = collectBundleFailures(page);
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
  await expect(
    dialog.getByText("1 Characters · 1 Light Cones · 1 Relics", { exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("ggstarrail:workspace:v1"))
  ).toBeNull();
  await dialog
    .getByRole("button", { name: "Apply reviewed data", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Bronya", { exact: true }).first()).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ggstarrail:workspace:v1") ?? "null")
  );
  expect(saved.state.account).toMatchObject({
    uid: "601869216",
    characters: [{ definitionId: "1101", level: 80, eidolon: 1 }],
    lightCones: [{ definitionId: "23005", superimposition: 3 }],
    relics: [{ level: 15, slot: "hands" }],
  });
  await page.reload();
  await expect(page.getByText("Bronya", { exact: true }).first()).toBeVisible();
  await page.goto("/account-data/inventory");
  await expectResponsiveShell(page);
  await page.goto("/team-damage/optimizer");
  await page
    .getByRole("button", { name: "Add Character", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Bronya", exact: true }).click();
  const combatWorker = page.waitForEvent("worker", {
    predicate: (worker) => worker.url().includes("combat.worker"),
  });
  await page
    .getByRole("button", { name: "DMG Optimizer", exact: true })
    .click();
  await combatWorker;
  await page
    .getByRole("button", { name: "Battle Timeline", exact: true })
    .click();
  await expect(page.locator("[data-timeline-action]").first()).toBeVisible();
  await expect(
    page.getByText("The simulation failed.", { exact: true })
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
