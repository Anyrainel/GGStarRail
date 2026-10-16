import { expect, type Locator, test } from "@playwright/test";
import { APP_PATHS } from "@/config/navigation";
import { ANALYSIS_MODES } from "@/domain/team/analysis";
import { emptyTeam, TeamMemberPlanSchema } from "@/domain/team/schemas";
import { DEFAULT_TEAM_STORE, TEAM_STORE_VERSION } from "@/stores/teamSchemas";

test.setTimeout(120_000);

async function expectBoundedScroller(scroller: Locator) {
  const bounds = await scroller.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height };
  });
  expect(bounds.height).toBeGreaterThan(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(
    (scroller.page().viewportSize()?.height ?? 0) + 1
  );
}

for (const short of [false, true]) {
  test(`every route reaches its last item (${short ? "short" : "standard"} viewport)`, async ({
    page,
  }, testInfo) => {
    if (short)
      await page.setViewportSize({
        width: testInfo.project.name === "mobile" ? 844 : 1280,
        height: 390,
      });
    await page.addInitScript(
      (locale) => {
        localStorage.setItem("ggstarrail:locale:v1", locale);
        localStorage.setItem("ggstarrail:theme:v1", "amphoreus");
      },
      testInfo.project.name === "mobile" ? "zh-CN" : "en"
    );

    for (const route of [
      ...new Set(Object.values(APP_PATHS)),
      "/callback",
      "/missing-page",
    ]) {
      await test.step(route, async () => {
        await page.goto(route);
        const scroller = page.locator("main *").filter({ visible: true });
        const findScroller = () =>
          scroller.evaluateAll((nodes) => {
            let index = -1;
            let area = 0;
            nodes.forEach((node, candidate) => {
              const style = getComputedStyle(node);
              const size = node.clientWidth * node.clientHeight;
              const ownsVerticalScroll = [...node.classList].some((value) =>
                /(^|:)overflow-(y-auto|y-scroll|auto|scroll)$/.test(value)
              );
              if (
                ownsVerticalScroll &&
                /auto|scroll/.test(style.overflowY) &&
                node.clientHeight > 40 &&
                size > area
              ) {
                index = candidate;
                area = size;
              }
            });
            return index;
          });
        await expect
          .poll(findScroller, {
            message: `${route} must select a shared scrolling layout`,
          })
          .toBeGreaterThanOrEqual(0);
        // Wait for the route's asynchronous catalog before inspecting its main
        // content pane, rather than its temporary loading layout or sidebar.
        await expect(
          page.locator("main [role=status] .animate-spin")
        ).toHaveCount(0);
        const index = await findScroller();
        const body = scroller.nth(index);
        await expectBoundedScroller(body);
        // Force overflow even for empty accounts; this tests the real route's
        // height chain without relying on how much account data happens to exist.
        await body.evaluate((node) => {
          const filler = document.createElement("div");
          filler.style.height = "2000px";
          filler.style.flexShrink = "0";
          const end = document.createElement("button");
          end.textContent = "Scroll end";
          end.dataset.scrollEnd = "";
          node.append(filler, end);
          node.scrollTop = node.scrollHeight;
        });
        await expect(body.locator("[data-scroll-end]")).toBeInViewport();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth
          )
        ).toBeLessThanOrEqual(1);
      });
    }
  });
}

test("all five team analysis modes scroll through real content after opening a team", async ({
  page,
}, testInfo) => {
  const team = emptyTeam("test:scroll-team");
  team.members = ["1102", "1101", "1008", "1001"].map((characterId) =>
    TeamMemberPlanSchema.parse({ characterId })
  );
  await page.addInitScript(
    ({ state, version }) => {
      localStorage.setItem("ggstarrail:locale:v1", "en");
      localStorage.setItem(
        "ggstarrail:teams:v1",
        JSON.stringify({ state, version })
      );
    },
    {
      state: { ...DEFAULT_TEAM_STORE, teams: [team], activeTeamId: team.id },
      version: TEAM_STORE_VERSION,
    }
  );
  await page.goto(`${APP_PATHS.teamDamage}?team=${team.id}`);
  const detail = page.locator("[data-team-detail]");
  await expect(detail).toBeVisible({ timeout: 30_000 });
  const body = page.locator("[data-scroll-body]").filter({ has: detail });
  for (const mode of ANALYSIS_MODES) {
    // Switch inside the mounted workspace, preserving the visited-team wrapper.
    await body.evaluate((node) => {
      node.scrollTop = 0;
    });
    await detail
      .getByRole("radiogroup", { name: "Calculation mode", exact: true })
      .getByRole("radio")
      .nth(ANALYSIS_MODES.indexOf(mode))
      .click();
    await expect(
      detail.locator(`[data-analysis-mode="${mode}"]`)
    ).toBeVisible();
    await expectBoundedScroller(body);
    await body.hover({ position: { x: 4, y: 4 } });
    await page.mouse.wheel(0, 10000);
    await expect
      .poll(() => body.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await expect
      .poll(async () => {
        await page.mouse.wheel(0, 2000);
        return body.evaluate(
          (node) => node.scrollHeight - node.clientHeight - node.scrollTop
        );
      })
      .toBeLessThanOrEqual(1);
    await expect(
      detail.locator(`[data-analysis-mode="${mode}"]`)
    ).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath(`analysis-${mode}.png`),
    });
  }
  // Returning to the grid keeps the visited detail mounted but hidden. Opening
  // it again must retain the same bounded height chain.
  await detail
    .getByRole("button", { name: "Back to teams", exact: true })
    .click();
  await expect(detail).toBeHidden();
  await page
    .locator(`[data-team-card="${team.id}"]`)
    .getByRole("button", { name: "Analysis", exact: true })
    .click();
  await expect(detail).toBeVisible();
  await expectBoundedScroller(body);
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 844 : 1280,
    height: 390,
  });
  await expectBoundedScroller(body);
  await body.hover({ position: { x: 4, y: 4 } });
  await page.mouse.wheel(0, 10000);
  await expect
    .poll(() => body.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
});
