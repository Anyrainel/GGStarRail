import { expect, test } from "@playwright/test";

for (const locale of ["en", "zh-CN"] as const) {
  test(`catalogs request only ${locale} on direct archive routes`, async ({
    page,
  }) => {
    await page.addInitScript(
      (locale) => localStorage.setItem("ggstarrail:locale:v1", locale),
      locale
    );
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/archive/characters");
    await expect(
      page.getByRole("region", {
        name: locale === "en" ? "Character catalog results" : "角色图鉴结果",
      })
    ).toBeVisible();
    await expect(page.getByRole("main")).toContainText(
      locale === "en" ? "March 7th" : "三月七"
    );
    await page.waitForLoadState("networkidle");
    const other = locale === "en" ? "zh" : "en";
    expect(
      requests.filter((url) =>
        new RegExp(
          `/(characters|property_tables|light_cones|relic_sets|relic_pieces)_${other}-`
        ).test(url)
      )
    ).toEqual([]);
    const selected = locale === "en" ? "en" : "zh";
    expect(
      requests.some((url) => new RegExp(`/characters_${selected}-`).test(url))
    ).toBe(true);
    await page.goto("/archive/achievements");
    await expect(page.getByRole("main")).toContainText(
      locale === "en" ? "Achievement" : "成就"
    );
    await page.waitForLoadState("networkidle");
    expect(
      requests.some((url) => new RegExp(`/achievements_${other}-`).test(url))
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}
