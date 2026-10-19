import { expect, test } from "@playwright/test";
import { APP_PATHS } from "@/config/navigation";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import {
  AccountSnapshotSchema,
  type RelicSlot,
} from "@/domain/game-account/schemas";
import { DEFAULT_WORKSPACE, WORKSPACE_SCHEMA_VERSION } from "@/stores/schemas";
import { makeAccountSnapshot, makeRelic } from "../fixtures";

const profile: ScoreProfile = {
  id: "score:planning-e2e",
  statWeights: {
    CriticalChanceBase: 1,
    CriticalDamageBase: 1,
    SpeedDelta: 0.7,
  },
  includeMainStat: false,
  mainStatWeight: 0,
  gradeThresholds: { s: 80, a: 60, b: 40, c: 20 },
};
const builds: BuildConfiguration[] = [
  {
    id: "build:planning-cavern",
    characterDefinitionId: "1001",
    scoreProfileId: profile.id,
    category: "cavern",
    cavern: { mode: "four-piece", setId: "101" },
    preferredMainStats: { body: ["CriticalChanceBase"], feet: ["SpeedDelta"] },
  },
  {
    id: "build:planning-planar",
    characterDefinitionId: "1001",
    scoreProfileId: profile.id,
    category: "planar",
    planarSetId: "301",
    preferredMainStats: {
      planarSphere: ["IceAddedRatio"],
      linkRope: ["SPRatioBase"],
    },
  },
];

test("all four planning tabs have actionable empty states", async ({
  page,
}) => {
  for (const route of [
    APP_PATHS.recommendations,
    APP_PATHS.evaluation,
    APP_PATHS.resources,
    APP_PATHS.triage,
  ]) {
    await page.goto(route);
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: "Import game account", exact: true })
    ).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: "Open Character Builds", exact: true })
    ).toBeVisible();
    const bounds = await page.locator("[data-scroll-body]").boundingBox();
    expect(bounds!.height).toBeGreaterThan(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth
      )
    ).toBeLessThanOrEqual(1);
  }
});

function planningWorkspace() {
  const slots: [RelicSlot, string, string][] = [
    ["head", "61011", "HPDelta"],
    ["hands", "61012", "AttackDelta"],
    ["body", "61013", "CriticalChanceBase"],
    ["feet", "61014", "SpeedDelta"],
    ["planarSphere", "63015", "IceAddedRatio"],
    ["linkRope", "63016", "SPRatioBase"],
  ];
  const relics = slots.map(([slot, definitionId, mainStatId], index) =>
    makeRelic({
      key: `planning:${slot}`,
      definitionId,
      slot,
      setId: index < 4 ? "101" : "301",
      equippedCharacterKey: "character:1",
      mainStat: { statId: mainStatId, value: 1 },
      substats:
        mainStatId === "CriticalChanceBase"
          ? [{ statId: "CriticalDamageBase", value: 6.4 }]
          : [
              { statId: "CriticalChanceBase", value: 3.2 },
              { statId: "CriticalDamageBase", value: 6.4 },
            ],
    })
  );
  const account = makeAccountSnapshot();
  const character = account.characters[0]!;
  const upgraded = {
    ...relics[0]!,
    key: "planning:head-upgrade",
    equippedCharacterKey: undefined,
    substats: [
      { statId: "CriticalChanceBase", value: 19.4 },
      { statId: "CriticalDamageBase", value: 6.4 },
    ],
  };
  return {
    ...DEFAULT_WORKSPACE,
    builds,
    scoreProfiles: [profile],
    account: AccountSnapshotSchema.parse({
      ...account,
      characters: [
        {
          ...character,
          definitionId: "1001",
          lightConeKey: undefined,
          relicKeys: relics.map((relic) => relic.key),
        },
      ],
      lightCones: [],
      relics: [...relics, upgraded],
    }),
  };
}

test("six-slot account planning, safe equip and linked resource scope", async ({
  page,
}, testInfo) => {
  const workspace = planningWorkspace();
  const locale = testInfo.project.name === "mobile" ? "zh-CN" : "en";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ state, version, language }) => {
      localStorage.setItem("ggstarrail:locale:v1", language);
      localStorage.setItem("ggstarrail:theme:v1", "amphoreus");
      if (!localStorage.getItem("ggstarrail:workspace:v1"))
        localStorage.setItem(
          "ggstarrail:workspace:v1",
          JSON.stringify({ state, version })
        );
    },
    { state: workspace, version: WORKSPACE_SCHEMA_VERSION, language: locale }
  );

  await page.goto(APP_PATHS.recommendations);
  await expect(
    page.locator(
      '[data-recommendation-loadout="recommended"] [data-recommendation-slot]'
    )
  ).toHaveCount(6);
  const apply = page.getByRole("button", {
    name: locale === "en" ? "Apply to account data" : "应用到账户数据",
    exact: true,
  });
  await expect(apply).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath("recommendations.png"),
    animations: "disabled",
  });
  await page.locator("[data-scroll-body]").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    page.locator(
      '[data-recommendation-loadout="current"] [data-recommendation-slot="linkRope"]'
    )
  ).toBeInViewport();
  await apply.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = JSON.parse(
          localStorage.getItem("ggstarrail:workspace:v1")!
        ).state;
        return state.account.characters[0].relicKeys.includes(
          "planning:head-upgrade"
        );
      })
    )
    .toBe(true);
  await page.reload();
  await expect(apply).toBeDisabled();

  await page.goto(APP_PATHS.evaluation);
  await expect(page.locator("[data-build-completion]")).toHaveCount(2);
  await expect(page.locator("[data-completion-slot]")).toHaveCount(6);
  await page.screenshot({
    path: testInfo.outputPath("evaluation.png"),
    animations: "disabled",
  });
  await page.locator("[data-scroll-body]").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    page.locator('[data-build-completion="build:planning-planar"] footer')
  ).toBeInViewport();
  const cavern = page.locator(
    '[data-build-completion="build:planning-cavern"]'
  );
  const resourceLink = cavern.locator('a[href^="/account-data/resources?"]');
  await resourceLink.click();
  await expect(page).toHaveURL(/build=build%3Aplanning-cavern/);
  await expect(
    page.getByRole("button", {
      name: locale === "en" ? "All builds" : "查看全部配装",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText(locale === "en" ? "Planar Sphere" : "位面球", {
      exact: true,
    })
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("resources-scoped.png"),
    animations: "disabled",
  });

  await page.goto(APP_PATHS.triage);
  await expect(page.getByRole("tablist")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("triage.png"),
    animations: "disabled",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
