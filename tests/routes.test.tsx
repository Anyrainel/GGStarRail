import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "@/App";
import { ROUTE_REGISTRY } from "@/app/routeRegistry";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n/I18nContext";
import { messagesEn } from "@/i18n/messages.en";

describe("HSR route foundation", () => {
  it("contains every MVP route and excludes out-of-scope engines", () => {
    const paths = ROUTE_REGISTRY.map((route) => route.path);
    expect(paths).toEqual(Object.values(APP_PATHS));
    expect(paths.join(" ")).not.toMatch(/team|damage|energy/i);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(ROUTE_REGISTRY)("renders $path", async (route) => {
    render(
      <ThemeProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={[route.path]}>
            <App />
          </MemoryRouter>
        </I18nProvider>
      </ThemeProvider>
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: messagesEn[route.titleKey],
      })
    ).toBeInTheDocument();
    if (route.path === APP_PATHS.home) {
      await waitFor(() => {
        expect(document.querySelectorAll("[data-asset-source]")).toHaveLength(
          3
        );
      });
    }
  });

  it("renders a localized not-found route", () => {
    render(
      <ThemeProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={["/team-damage"]}>
            <App />
          </MemoryRouter>
        </I18nProvider>
      </ThemeProvider>
    );
    expect(
      screen.getByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument();
  });
});
