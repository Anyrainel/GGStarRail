import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { APP_PATHS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import NotFoundPage from "@/pages/NotFoundPage";

function Origin() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/missing")}>
      Open missing
    </button>
  );
}

function renderAt(entry: string) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={APP_PATHS.home} element={<h1>Home</h1>} />
          <Route path="/origin" element={<Origin />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("not-found page", () => {
  it("shows the status card with a home link", () => {
    renderAt("/missing");
    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute(
      "href",
      APP_PATHS.home
    );
  });

  it("goes back to the previous page", async () => {
    const user = userEvent.setup();
    renderAt("/origin");
    await user.click(screen.getByRole("button", { name: "Open missing" }));
    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(
      screen.getByRole("button", { name: "Open missing" })
    ).toBeInTheDocument();
  });

  it("goes home when there is no page to go back to", async () => {
    const user = userEvent.setup();
    renderAt("/missing");
    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Home" })
    ).toBeInTheDocument();
  });
});
