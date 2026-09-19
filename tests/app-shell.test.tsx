import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { AppShell } from "@/components/layout/AppShell";
import { STORAGE_KEYS } from "@/config/identity";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n/I18nContext";

function renderApp(path: string) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

describe("GGArtifact family shell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("owns tier file actions in the appbar and clears them on route changes", async () => {
    const user = userEvent.setup();
    renderApp("/tier-list/characters");
    const appbar = screen.getByRole("banner");
    expect(
      await within(appbar).findByRole(
        "button",
        { name: "Import list" },
        { timeout: 15000 }
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).queryByRole("button", {
        name: "Import list",
      })
    ).toBeNull();
    await user.click(within(appbar).getByRole("button", { name: "More" }));
    expect(
      screen.getByRole("menuitem", { name: "Export list" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Download image" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("link", { name: "Light Cone Priority" }));
    expect(
      await screen.findByRole("heading", { name: "Light Cone Priority" })
    ).toBeInTheDocument();
    expect(
      within(appbar).getAllByRole("button", { name: "Import list" })
    ).toHaveLength(1);
    await user.click(screen.getByRole("link", { name: "Archive" }));
    await waitFor(() =>
      expect(
        within(appbar).queryByRole("button", { name: "Import list" })
      ).toBeNull()
    );
    await user.click(within(appbar).getByRole("button", { name: "More" }));
    expect(screen.queryByRole("menuitem", { name: "Export list" })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "Download image" })
    ).toBeNull();
  });

  it("exposes a selected Star Rail site and a plain Genshin site link", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.archiveCharacters);

    await user.click(screen.getByRole("button", { name: "Switch game site" }));

    expect(
      screen.getByRole("menuitem", { name: "Genshin Impact" })
    ).toHaveAttribute("href", "https://ggartifact.com");
    const starRailItem = screen.getByRole("menuitem", {
      name: "Honkai: Star Rail",
    });
    expect(starRailItem).toHaveAttribute("href", APP_PATHS.home);
    expect(starRailItem).toHaveAttribute("aria-current", "page");
  });

  it("derives the active top-level section and archive tab from the route", () => {
    renderApp(APP_PATHS.archiveAchievements);

    const archiveTabs = screen.getByRole("navigation", {
      name: "Archive catalogs",
    });
    expect(
      within(archiveTabs).getByRole("link", { name: "Achievements" })
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Archive" })).toHaveClass(
      "text-primary"
    );
  });

  it("keeps all Account Data destinations in the shared tab strip", () => {
    renderApp(APP_PATHS.characters);
    const accountTabs = screen.getByRole("navigation", {
      name: "Account Data",
    });

    for (const label of [
      "Characters",
      "Inventory",
      "Resources",
      "Relic Triage",
    ]) {
      expect(
        within(accountTabs).getByRole("link", { name: label })
      ).toBeVisible();
    }
    for (const obsolete of ["Light Cones", "Relics", "Planar Ornaments"]) {
      expect(
        within(accountTabs).queryByRole("link", { name: obsolete })
      ).toBeNull();
    }
  });

  it("opens account import directly from the Account Data app bar", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.inventory);

    const [appBarImport] = screen.getAllByRole("button", {
      name: "Import account",
    });
    await user.click(appBarImport);

    expect(
      screen.getByRole("dialog", { name: "Import account data" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "UID profile showcase" })
    ).toBeInTheDocument();

    const cookie = screen.getByLabelText("Cookie header");
    await user.type(cookie, "ltoken_v2=transient-only");
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Import account data" })
      ).getByRole("button", { name: "Close" })
    );
    await user.click(appBarImport);
    expect(screen.getByLabelText("Cookie header")).toHaveValue("");
  });

  it("keeps Data Sources as secondary diagnostics until import is requested", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.imports);

    expect(
      screen.queryByRole("heading", { name: "UID profile showcase" })
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: "Import account" })
    );
    expect(
      screen.getByRole("heading", { name: "UID profile showcase" })
    ).toBeInTheDocument();
  });

  it("groups every section in the mobile navigation dialog", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.characters);

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Account Data")).toBeVisible();
    expect(within(dialog).getByText("Builds")).toBeVisible();
    expect(within(dialog).getByText("Tier List")).toBeVisible();
    expect(within(dialog).getByText("Archive")).toBeVisible();
    expect(
      within(dialog).getByRole("link", { name: "Data Sources" })
    ).toBeVisible();
    expect(
      within(dialog).getByRole("link", { name: "Relic Triage" })
    ).toHaveAttribute("href", APP_PATHS.triage);
  });

  it("hides the redundant section tabs at mobile widths", () => {
    renderApp(APP_PATHS.builds);

    expect(screen.getByTestId("section-tabs")).toHaveClass(
      "hidden",
      "md:block"
    );
    const buildTabs = screen.getByRole("navigation", { name: "Builds" });
    expect(within(buildTabs).getAllByRole("link")).toHaveLength(2);
    expect(
      within(buildTabs).queryByRole("link", { name: "Relic Triage" })
    ).toBeNull();
    expect(
      within(buildTabs).queryByRole("link", { name: "Scoring" })
    ).toBeNull();
  });

  it("keeps the app shell bounded so page layouts own content scrolling", () => {
    const { unmount } = renderApp(APP_PATHS.characters);

    expect(screen.getByRole("main")).toHaveClass("overflow-hidden", "min-h-0");
    expect(screen.getByTestId("app-content")).toHaveClass("flex-1", "min-h-0");

    unmount();
    render(
      <ThemeProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={[APP_PATHS.home]}>
            <AppShell>Home</AppShell>
          </MemoryRouter>
        </I18nProvider>
      </ThemeProvider>
    );
    expect(screen.getByRole("main")).toHaveClass("overflow-hidden", "min-h-0");
    expect(screen.getByTestId("app-content")).toHaveClass("flex-1", "min-h-0");
  });

  it("switches locale through the GGArtifact-style utility menu", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.archiveCharacters);

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "简体中文" })
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "角色图鉴" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "切换游戏站点" })
    ).toBeInTheDocument();
  });

  it("shows separate home utilities and keeps build actions in the app bar", async () => {
    const user = userEvent.setup();
    const home = renderApp(APP_PATHS.home);
    expect(
      screen.getByRole("button", { name: "Language" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
    home.unmount();
    renderApp(APP_PATHS.builds);
    const header = document.querySelector("header");
    expect(header).not.toBeNull();
    expect(
      await within(header!).findByRole("button", { name: "Import builds" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Build workspace backup")
    ).not.toBeInTheDocument();
    await user.click(within(header!).getByRole("button", { name: "More" }));
    expect(
      screen.getByRole("menuitem", { name: "Export builds" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Clear workspace" })
    ).toBeInTheDocument();
  });

  it("persists an explicitly selected theme", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.characters);

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: "Penacony · Dream neon",
      })
    );

    expect(document.documentElement.dataset.theme).toBe("dreamscape");
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe("dreamscape");
  });

  it("does not show section tabs or active state on an invalid prefixed route", () => {
    renderApp("/archive/not-a-route");

    expect(
      screen.queryByRole("navigation", { name: "Archive catalogs" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archive" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
