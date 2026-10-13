import { expect, type Page, test } from "@playwright/test";

test.setTimeout(90_000);

async function openAction(page: Page, name: string) {
  const header = page.getByRole("banner");
  const button = header.getByRole("button", { name, exact: true });
  if (await button.isVisible()) await button.click();
  else {
    await header.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  }
}

test("build preset chooser reviews before applying and survives reload", async ({
  page,
}, testInfo) => {
  await page.goto("/builds/configure");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import builds", exact: true })
  ).toBeVisible();
  await openAction(page, "Import");
  const picker = page.getByRole("dialog");
  await expect(
    picker.getByRole("button", { name: "Import from file", exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("build-preset-picker.png"),
  });
  await picker
    .getByRole("button", { name: "In-Game Recommended Builds", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Review build workspace import",
      exact: true,
    })
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("ggstarrail:workspace:v1"))
  ).toBeNull();
  await page
    .getByRole("button", { name: "Subscribe to preset", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const before = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ggstarrail:workspace:v1") ?? "null")
        .state
  );
  expect(before.builds.length).toBeGreaterThan(100);
  expect(before.scoreProfiles.length).toBe(before.builds.length);
  expect(before.buildPresetSubscription.presetId).toBe("in-game");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Character Builds", exact: true })
  ).toBeVisible({ timeout: 20_000 });
  const after = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ggstarrail:workspace:v1") ?? "null")
        .state
  );
  expect(after).toEqual(before);
  await openAction(page, "Import");
  await expect(
    page.getByRole("button", {
      name: "In-Game Recommended Builds Subscribed",
      exact: true,
    })
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("build-preset-subscribed.png"),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  // A prior released file had this name; the current bundle must refresh its
  // untouched row at startup while preserving a separate local edit.
  await page.evaluate(() => {
    const saved = JSON.parse(
      localStorage.getItem("ggstarrail:workspace:v1") ?? "null"
    );
    saved.state.builds[0].name = "Previous file name";
    saved.state.buildPresetSubscription.baseline.builds[0].name =
      "Previous file name";
    saved.state.builds[1].name = "My local build";
    localStorage.setItem("ggstarrail:workspace:v1", JSON.stringify(saved));
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ggstarrail:workspace:v1") ?? "null")
            .state.builds[0].name
      )
    )
    .toBeUndefined();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ggstarrail:workspace:v1") ?? "null")
          .state.builds[1].name
    )
  ).toBe("My local build");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath("build-preset-applied.png"),
  });
});

test("flagship teams review, hydrate and export for local import", async ({
  page,
}, testInfo) => {
  await page.goto("/team-damage/analysis");
  await expect(
    page.getByRole("button", { name: "Add Character", exact: true }).first()
  ).toBeVisible();
  await openAction(page, "Import");
  await expect(
    page.getByRole("button", { name: "Import from file", exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("team-preset-picker.png"),
  });
  await page
    .getByRole("button", { name: "Flagship Teams", exact: true })
    .click();
  const review = page.getByRole("dialog");
  await expect(review.getByText(/Silver Wolf LV.999/).first()).toBeVisible();
  await review.getByRole("button", { name: "Subscribe", exact: true }).click();
  await expect(review).toBeHidden();
  await expect(page.locator("[data-team-card]").first()).toBeVisible();
  const teamCount = await page.locator("[data-team-card]").count();
  expect(teamCount).toBeGreaterThan(25);
  await page.screenshot({
    path: testInfo.outputPath("team-preset-applied.png"),
  });
  await page.reload();
  await expect(page.locator("[data-team-card]")).toHaveCount(teamCount);
  const subscribed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ggstarrail:teams:v1") ?? "null")
  );
  expect(subscribed.state.presetSubscription.presetId).toBe("flagship-teams");
  await openAction(page, "Import");
  await expect(
    page.getByRole("button", { name: "Flagship Teams Subscribed", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("team-preset-subscribed.png"),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  await page.evaluate(() => {
    const saved = JSON.parse(
      localStorage.getItem("ggstarrail:teams:v1") ?? "null"
    );
    saved.state.teams[0].cycles = 1;
    saved.state.presetSubscription.baseline[0].cycles = 1;
    saved.state.teams[1].name = "My local team";
    saved.state.teams.splice(2, 1);
    localStorage.setItem("ggstarrail:teams:v1", JSON.stringify(saved));
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ggstarrail:teams:v1") ?? "null")
            .state.teams[0].cycles
      )
    )
    .toBe(3);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ggstarrail:teams:v1") ?? "null").state
          .teams[1].name
    )
  ).toBe("My local team");
  await expect(page.locator("[data-team-card]")).toHaveCount(teamCount - 1);
  const downloadEvent = page.waitForEvent("download");
  await openAction(page, "Export");
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("ggstarrail-teams.json");
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  await openAction(page, "Import");
  const chooserEvent = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import from file", exact: true })
    .click();
  await (await chooserEvent).setFiles(filePath!);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import teams", exact: true })
    .click();
  await expect(page.locator("[data-team-card]")).toHaveCount(teamCount - 1);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});
