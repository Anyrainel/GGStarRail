import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { I18nProvider } from "@/i18n/I18nContext";
import { BetaPreviews } from "@/pages/archive/BetaPreviews";

vi.mock("@/providers/gilore/catalog", () => ({
  getLocalizedValue: (
    value: Record<string, { value: string }>,
    locale: string
  ) => value[locale].value,
}));

vi.mock("@/data/gameDataLoader", () => ({
  loadGameMember: async () => ({
    value: [
      {
        id: "preview",
        name: {
          en: { value: "Preview character" },
          "zh-CN": { value: "前瞻角色" },
        },
        rarity: 5,
        image_path: null,
        stats: {},
        source_url: "https://hsr.nanoka.cc/",
        source_version: "test",
        sections: [
          {
            id: "skill:1",
            title: { en: { value: "Skill" }, "zh-CN": { value: "战技" } },
            description: {
              en: { value: "Deals #1[i]% damage." },
              "zh-CN": { value: "造成#1[i]%伤害。" },
            },
            parameters: [[0.5], [0.8]],
          },
        ],
      },
    ],
  }),
}));

it("renders partial source details and applies the selected skill level without inventing missing stats", async () => {
  localStorage.setItem(STORAGE_KEYS.locale, "en");
  render(
    <I18nProvider>
      <BetaPreviews kind="characters" />
    </I18nProvider>
  );
  const name = await screen.findByText("Preview character");
  const user = userEvent.setup();
  await user.click(name);
  expect(screen.getByText("Deals 50% damage.")).toBeVisible();
  await user.selectOptions(screen.getByRole("combobox"), "1");
  expect(screen.getByText("Deals 80% damage.")).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText(/not yet available in build tools/)).toBeVisible();
});
