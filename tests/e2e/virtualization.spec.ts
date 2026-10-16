import path from "node:path";
import { expect, type Locator, test } from "@playwright/test";

async function scrollCollection(
  collection: Locator,
  position: "top" | "bottom"
) {
  await collection.evaluate((element, position) => {
    let parent = element.parentElement;
    while (
      parent &&
      !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)
    ) {
      parent = parent.parentElement;
    }
    if (!parent) throw new Error("Collection has no page scroller");
    parent.scrollTop = position === "top" ? 0 : parent.scrollHeight;
  }, position);
}

test("build cards stay bounded and filtering works after scrolling", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/builds/configure");
  const collection = page
    .locator("[data-character-build-list] [data-virtual-collection]")
    .first();
  const cards = page.locator("[data-character-build-card]");
  await expect(cards.first()).toBeVisible();
  await expect(collection.locator("[data-virtuoso-scroller]")).toHaveCount(1);
  expect(await cards.count()).toBeLessThan(24);
  const firstId = await cards.first().getAttribute("data-character-build-card");
  await scrollCollection(collection, "bottom");
  await expect
    .poll(() => cards.first().getAttribute("data-character-build-card"))
    .not.toBe(firstId);
  await expect(cards.last()).toBeVisible();
  expect(await cards.count()).toBeLessThan(24);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Filters", exact: true }).click();
  }
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("Seele");
  if (testInfo.project.name === "mobile") {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute(
    "data-character-build-card",
    "1102"
  );
  await expect(cards.first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("build-filtered.png"),
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("relic archive virtualizes responsive rows and expanded cards", async ({
  page,
}, testInfo) => {
  await page.goto("/archive/relic-sets");
  const collection = page.locator("[data-virtual-collection]").first();
  const cards = page.locator("[data-relic-set-id]");
  await expect(cards.first()).toBeVisible();
  await expect(collection.locator("[data-virtuoso-scroller]")).toHaveCount(1);
  expect(await cards.count()).toBeLessThan(24);
  const firstId = await cards.first().getAttribute("data-relic-set-id");
  const expand = cards.first().getByRole("button", { name: "Show more" });
  if (await expand.isVisible()) {
    await expand.click();
    await expect(
      cards.first().getByRole("button", { name: "Show less" })
    ).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath("relic-grid.png") });
  await scrollCollection(collection, "bottom");
  await expect
    .poll(() => cards.first().getAttribute("data-relic-set-id"))
    .not.toBe(firstId);
  await expect(cards.last()).toBeVisible();
  expect(await cards.count()).toBeLessThan(24);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
  ).toBeLessThanOrEqual(1);
});

test("scrolling an edited build out of view saves its name", async ({
  page,
}) => {
  await page.goto("/builds/configure");
  const collection = page
    .locator("[data-character-build-list] [data-virtual-collection]")
    .first();
  const firstCard = page.locator("[data-character-build-card]").first();
  await firstCard
    .getByRole("button", { name: "Add Cavern Relic build", exact: true })
    .click();
  const name = firstCard.getByRole("textbox", {
    name: "Build name",
    exact: true,
  });
  await name.fill("Virtualized draft");
  await scrollCollection(collection, "bottom");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          localStorage.getItem("ggstarrail:workspace:v1")!
        );
        return saved.state.builds[0].name;
      })
    )
    .toBe("Virtualized draft");
  await scrollCollection(collection, "top");
  await expect(name).toHaveValue("Virtualized draft");
});

test("currency war virtualizes cards and reveals linked offscreen equipment", async ({
  page,
}, testInfo) => {
  await page.goto("/archive/currency-war?tab=equipment");
  const collection = page.locator("[data-virtual-collection]").first();
  const cards = page.locator('[id^="currency-war-card-"]');
  await expect(cards.first()).toBeVisible();
  await expect(collection.locator("[data-virtuoso-scroller]")).toHaveCount(1);
  expect(await cards.count()).toBeLessThan(24);
  const firstId = await cards.first().getAttribute("id");
  await scrollCollection(collection, "bottom");
  await expect.poll(() => cards.first().getAttribute("id")).not.toBe(firstId);
  const targetId = await cards.last().getAttribute("id");
  const id = targetId!.replace("currency-war-card-", "");
  await page.goto(`/archive/currency-war?tab=equipment&id=${id}`);
  const target = page.locator(`[id="${targetId}"]`);
  await expect(target).toBeInViewport();
  await expect(target).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("currency-war-linked.png"),
  });
});

test("a 2001-relic inventory mounts only nearby rows", async ({
  page,
}, testInfo) => {
  await page.goto("/account-data/characters");
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
  await expect(dialog).toBeHidden();
  await page.evaluate(() => {
    const key = "ggstarrail:workspace:v1";
    const saved = JSON.parse(localStorage.getItem(key)!);
    const original = saved.state.account.relics[0];
    saved.state.account.relics = [
      original,
      ...Array.from({ length: 2000 }, (_, index) => {
        const relic = { ...original, key: `virtualization-relic-${index}` };
        delete relic.equippedCharacterKey;
        return relic;
      }),
    ];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.goto("/account-data/inventory");
  const collection = page
    .locator("[data-relic-group] [data-virtual-collection]")
    .first();
  const tiles = collection.locator("[data-relic-key]");
  await expect(tiles.first()).toBeVisible();
  await expect(collection.locator("[data-virtuoso-scroller]")).toHaveCount(1);
  expect(await tiles.count()).toBeLessThan(500);
  const firstKey = await tiles.first().getAttribute("data-relic-key");
  await scrollCollection(collection, "bottom");
  await expect
    .poll(() => tiles.first().getAttribute("data-relic-key"))
    .not.toBe(firstKey);
  await expect(tiles.last()).toBeVisible();
  expect(await tiles.count()).toBeLessThan(500);
  await page.screenshot({ path: testInfo.outputPath("large-inventory.png") });
});
