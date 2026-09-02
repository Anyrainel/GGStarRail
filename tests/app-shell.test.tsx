import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
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

  it("exposes a selected Star Rail site and a plain Genshin site link", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.archiveCharacters);

    await user.click(screen.getByRole("button", { name: "Switch game site" }));

    expect(
      screen.getByRole("menuitem", { name: "GGArtifactGenshin Impact" })
    ).toHaveAttribute("href", "https://ggartifact.com");
    const starRailItem = screen.getByRole("menuitem", {
      name: "GGStarRailHonkai: Star Rail",
    });
    expect(starRailItem).toHaveAttribute("href", APP_PATHS.home);
    expect(starRailItem).toHaveAttribute("aria-current", "page");
  });

  it("derives the active top-level section and archive tab from the route", () => {
    renderApp(APP_PATHS.archiveLightCones);

    const archiveTabs = screen.getByRole("navigation", {
      name: "Archive catalogs",
    });
    expect(
      within(archiveTabs).getByRole("link", { name: "Light Cone Archive" })
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
    await user.click(screen.getByRole("button", { name: "Import account" }));
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

  it("switches locale through the GGArtifact-style utility menu", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.archiveCharacters);

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "简体中文" })
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "角色图鉴" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "切换游戏站点" })
    ).toBeInTheDocument();
  });

  it("persists an explicitly selected theme", async () => {
    const user = userEvent.setup();
    renderApp(APP_PATHS.characters);

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Dreamscape" })
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
