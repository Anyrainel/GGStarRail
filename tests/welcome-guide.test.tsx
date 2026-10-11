import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { WelcomeGuideManual } from "@/components/home/WelcomeGuideManual";
import { STORAGE_KEYS } from "@/config/identity";
import { APP_PATHS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";

function renderGuide() {
  render(
    <I18nProvider>
      <MemoryRouter>
        <WelcomeGuideManual />
      </MemoryRouter>
    </I18nProvider>
  );
  return userEvent.setup();
}

describe("welcome guide", () => {
  it("explains the core workflow, switches examples, and leaves account data untouched", async () => {
    const user = renderGuide();
    await user.click(screen.getByRole("button", { name: "Quick Guide" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(
      dialog.getByRole("button", { name: "UID profile showcase" })
    );
    expect(dialog.getByText(/A UID showcase includes/)).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Next" }));
    expect(dialog.getByRole("heading", { name: "Builds" })).toBeVisible();
    expect(
      dialog.getByRole("link", { name: "Configure builds" })
    ).toHaveAttribute("href", APP_PATHS.builds);
    await user.click(dialog.getByRole("button", { name: "Filters" }));
    expect(dialog.getByText(/Missing Speed, weighted at 100%/)).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Next steps" }));
    await user.click(dialog.getByRole("button", { name: "Resources" }));
    expect(dialog.getByText(/Leveling considers growth room/)).toBeVisible();
    expect(dialog.getByRole("link", { name: "Relic Triage" })).toHaveAttribute(
      "href",
      APP_PATHS.triage
    );
    expect(localStorage.getItem(STORAGE_KEYS.workspace)).toBeNull();
  });

  it("closes on a page link and restarts at import when reopened", async () => {
    const user = renderGuide();
    await user.click(screen.getByRole("button", { name: "Quick Guide" }));
    await user.click(screen.getByRole("button", { name: "Explore" }));
    await user.click(screen.getByRole("link", { name: "Archive" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quick Guide" }));
    expect(screen.getByRole("heading", { name: "Import" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Explore" }));
    await user.click(screen.getByRole("button", { name: "Let's go" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the Chinese workflow and coverage boundaries", async () => {
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    const user = renderGuide();
    await user.click(screen.getByRole("button", { name: "使用教程" }));
    await user.click(screen.getByRole("button", { name: "UID 个人展示导入" }));
    expect(screen.getByText(/不含未装备遗器/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "配置配装" }));
    expect(screen.getByText(/≥60%：计入有效副词条数量/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "整理与养成" }));
    expect(screen.getByText(/分解复核不会自动分解/)).toBeVisible();
    expect(screen.getByRole("link", { name: "资源建议" })).toHaveAttribute(
      "href",
      APP_PATHS.resources
    );
  });
});
