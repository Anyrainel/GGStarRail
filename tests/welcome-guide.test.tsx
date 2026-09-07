import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { APP_PATHS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import HomePage from "@/pages/HomePage";

describe("home quick guide", () => {
  it("opens without leaving home, supports step navigation, resets on reopening, and follows a tool link", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[APP_PATHS.home]}>
          <Routes>
            <Route path={APP_PATHS.home} element={<HomePage />} />
            <Route
              path={APP_PATHS.characters}
              element={<h1>Account route destination</h1>}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
    await user.click(screen.getByRole("button", { name: "Quick Guide" }));
    let guide = screen.getByRole("dialog", { name: "Account Data" });
    expect(
      screen.queryByText("Account route destination")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "GGArtifact", hidden: true })
    ).toBeInTheDocument();
    expect(
      within(guide).getByRole("button", { name: "Previous" })
    ).toBeDisabled();

    await user.click(within(guide).getByRole("button", { name: "Next" }));
    guide = screen.getByRole("dialog", { name: "Builds" });
    await user.click(within(guide).getByRole("button", { name: "Previous" }));
    guide = screen.getByRole("dialog", { name: "Account Data" });
    await user.click(within(guide).getByRole("button", { name: "Tier List" }));
    guide = screen.getByRole("dialog", { name: "Tier List" });
    expect(
      within(guide).getByRole("button", { name: "Tier List" })
    ).toHaveAttribute("aria-current", "step");
    await user.click(within(guide).getByRole("button", { name: "Next" }));
    guide = screen.getByRole("dialog", { name: "Archive" });
    await user.click(within(guide).getByRole("button", { name: "Let's go" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quick Guide" }));
    guide = screen.getByRole("dialog", { name: "Account Data" });
    expect(
      within(guide).getByRole("button", { name: "Previous" })
    ).toBeDisabled();
    await user.click(
      within(guide).getByRole("link", { name: "Open account data" })
    );
    expect(
      await screen.findByRole("heading", { name: "Account route destination" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Quick Guide" })
    ).not.toBeInTheDocument();
  });
});
