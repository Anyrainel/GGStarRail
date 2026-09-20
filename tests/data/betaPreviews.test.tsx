import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { I18nProvider } from "@/i18n/I18nContext";
import { BetaPreviews } from "@/pages/archive/BetaPreviews";

const previewFixture = vi.hoisted(() => ({
  stats: {} as Record<string, number[]>,
}));
beforeEach(() => {
  previewFixture.stats = {};
});

vi.mock("@/providers/reference/catalog", () => ({
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
        stats: previewFixture.stats,
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

it("opens preview effects and applies the selected skill level without technical source details", async () => {
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
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(
    screen.queryByText(/not yet available in build tools/)
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Nanoka|source_version|skill:1/)
  ).not.toBeInTheDocument();
});

it("shows named initial stats without exposing growth arrays or unknown engine fields", async () => {
  previewFixture.stats = {
    base_hp: [48, 105.6],
    base_hp_add: [7.2, 7.2],
    unknown_engine_stat: [3000],
  };
  const user = userEvent.setup();
  render(
    <I18nProvider>
      <BetaPreviews kind="characters" />
    </I18nProvider>
  );
  await user.click(
    await screen.findByRole("button", { name: "Preview character" })
  );
  const dialog = screen.getByRole("dialog", { name: "Preview character" });
  expect(within(dialog).getByText("HP", { exact: true })).toBeVisible();
  expect(within(dialog).getByText("48", { exact: true })).toBeVisible();
  expect(dialog).not.toHaveTextContent(
    /105\.6|7\.2|3000|base_hp|unknown_engine_stat|Nanoka/
  );
  expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
});
