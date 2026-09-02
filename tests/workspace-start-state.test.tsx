import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APP_PATHS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import CharactersPage from "@/pages/account/CharactersPage";
import InventoryPage from "@/pages/account/InventoryPage";
import LightConesPage from "@/pages/account/LightConesPage";
import RelicsPage from "@/pages/account/RelicsPage";
import BuildsPage from "@/pages/builds/BuildsPage";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";

function renderPage(page: ReactElement) {
  return render(
    <I18nProvider>
      <MemoryRouter>{page}</MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
});

afterEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
});

describe("Fresh workspace actions", () => {
  it.each([
    ["characters", () => <CharactersPage />],
    ["inventory", () => <InventoryPage />],
    ["light cones", () => <LightConesPage />],
    [
      "relics",
      () => (
        <RelicsPage
          category="cavern"
          titleKey="route.relics.title"
          descriptionKey="route.relics.description"
          emptyKey="empty.relics"
        />
      ),
    ],
    [
      "planar ornaments",
      () => (
        <RelicsPage
          category="planar"
          titleKey="route.planar.title"
          descriptionKey="route.planar.description"
          emptyKey="empty.planar"
        />
      ),
    ],
  ])("offers demo data and imports on %s", (_name, page) => {
    renderPage(page());

    expect(
      screen.getByRole("button", { name: "Load demo account" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Data Sources" })).toHaveAttribute(
      "href",
      APP_PATHS.imports
    );
  });

  it("loads the built-in demo into the workspace", async () => {
    const user = userEvent.setup();
    renderPage(<CharactersPage />);

    await user.click(screen.getByRole("button", { name: "Load demo account" }));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().account).toMatchObject({
        profileId: "demo-account:v1",
        source: { provider: "demo-account" },
      });
    });
  });

  it("keeps empty build configuration prototype-aware", () => {
    useWorkspaceStore.getState().replaceAccount(makeAccountSnapshot());
    renderPage(<BuildsPage />);

    expect(
      screen.getByText(/Build editing is not available in this prototype yet/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View account data" })
    ).toHaveAttribute("href", APP_PATHS.characters);
    expect(screen.getByRole("link", { name: "Data Sources" })).toHaveAttribute(
      "href",
      APP_PATHS.imports
    );
    expect(
      screen.queryByRole("button", { name: "Load demo account" })
    ).not.toBeInTheDocument();
  });
});
