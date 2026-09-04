import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APP_PATHS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import CharacterView from "@/pages/account-data/CharacterView";
import InventoryView from "@/pages/account-data/InventoryView";
import CharacterBuildView from "@/pages/artifact-builds/CharacterBuildView";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function renderPage(page: ReactElement) {
  return render(
    <I18nProvider>
      <MemoryRouter>{page}</MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("Fresh workspace actions", () => {
  it.each([
    ["characters", () => <CharacterView />],
    ["inventory", () => <InventoryView />],
  ])("offers account import before demo data on %s", (_name, page) => {
    renderPage(page());

    expect(
      screen.getByRole("button", { name: "Import account" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load demo account" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Data source details" })
    ).toHaveAttribute("href", APP_PATHS.imports);
  });

  it("opens the responsive account import flow from an empty Account Data page", async () => {
    const user = userEvent.setup();
    renderPage(<CharacterView />);

    await user.click(screen.getByRole("button", { name: "Import account" }));

    const dialog = screen.getByRole("dialog", { name: "Import account data" });
    expect(dialog).toBeInTheDocument();
    const methodHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(methodHeadings.map((heading) => heading.textContent)).toEqual([
      "UID profile showcase",
      "HoYoLAB / 米游社 credential import",
      "Local account import",
      "Demo account",
    ]);
    expect(screen.getByLabelText("Choose JSON file").parentElement).toHaveClass(
      "focus-within:ring-2"
    );
  });

  it("loads the built-in demo into the workspace", async () => {
    const user = userEvent.setup();
    renderPage(<CharacterView />);

    await user.click(screen.getByRole("button", { name: "Load demo account" }));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().account).toMatchObject({
        profileId: "demo-account:v3",
        source: { provider: "demo-account" },
      });
    });
  });

  it("creates and edits a full-catalog build without an account", async () => {
    const user = userEvent.setup();
    renderPage(<CharacterBuildView />);

    const createButtons = await screen.findAllByRole("button", {
      name: "Add First Build",
    });
    expect(screen.getAllByRole("heading", { name: "March 7th" })).toHaveLength(
      2
    );
    expect(
      screen.getAllByRole("heading", { name: "Trailblazer · Caelus" }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("heading", { name: "Silver Wolf LV.999" }).length
    ).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent(/<unbreak>|\{NICKNAME\}/);
    expect(
      screen.queryByRole("button", { name: "Load demo account" })
    ).not.toBeInTheDocument();

    await user.click(createButtons[0]);
    await waitFor(() => {
      expect(useWorkspaceStore.getState().account).toBeNull();
      expect(useWorkspaceStore.getState().builds).toHaveLength(1);
      expect(useWorkspaceStore.getState().scoreProfiles).toHaveLength(1);
    });

    const nameField = screen.getByRole("textbox", { name: "Build name" });
    await user.clear(nameField);
    await user.type(nameField, "No-account catalog build");
    await user.tab();
    await waitFor(() => {
      expect(useWorkspaceStore.getState().builds[0]?.name).toBe(
        "No-account catalog build"
      );
    });
  }, 15_000);

  it("imports and edits a build workspace without an account", async () => {
    const user = userEvent.setup();
    renderPage(<CharacterBuildView />);

    const [createButton] = await screen.findAllByRole("button", {
      name: "Add First Build",
    });
    await user.click(createButton);
    const state = useWorkspaceStore.getState();
    const bundle = {
      schema: "ggstarrail.build-workspace",
      schemaVersion: 1,
      exportedAt: "2026-09-02T00:00:00.000Z",
      builds: state.builds,
      scoreProfiles: state.scoreProfiles,
      triageRules: state.triageRules,
    };

    act(() => {
      useWorkspaceStore.getState().replaceBuildWorkspace({
        builds: [],
        scoreProfiles: [],
        triageRules: state.triageRules,
      });
    });
    expect(useWorkspaceStore.getState().account).toBeNull();

    await user.upload(
      screen.getByLabelText("Import builds"),
      new File([JSON.stringify(bundle)], "builds.json", {
        type: "application/json",
      })
    );
    await user.click(
      await screen.findByRole("button", { name: "Replace build workspace" })
    );

    const nameField = await screen.findByRole("textbox", {
      name: "Build name",
    });
    await user.clear(nameField);
    await user.type(nameField, "Imported no-account build");
    await user.tab();
    await waitFor(() => {
      expect(useWorkspaceStore.getState().account).toBeNull();
      expect(useWorkspaceStore.getState().builds[0]?.name).toBe(
        "Imported no-account build"
      );
    });
  }, 15_000);

  it("reviews invalid build bundles without replacing local builds", async () => {
    const user = userEvent.setup();
    renderPage(<CharacterBuildView />);
    const [createButton] = await screen.findAllByRole("button", {
      name: "Add First Build",
    });
    await user.click(createButton);
    const state = useWorkspaceStore.getState();
    const build = state.builds[0];
    if (!build) throw new Error("Expected a generated build");
    const cavernSetId =
      build.cavern.mode === "four-piece"
        ? build.cavern.setId
        : build.cavern.setIds[0];
    const baseBundle = {
      schema: "ggstarrail.build-workspace",
      schemaVersion: 1,
      exportedAt: "2026-09-02T00:00:00.000Z",
      builds: [build],
      scoreProfiles: state.scoreProfiles,
      triageRules: state.triageRules,
    };
    const cases = [
      {
        name: "duplicate",
        value: { ...baseBundle, builds: [build, build] },
        message: "Every build and scoring profile must have a unique ID",
      },
      {
        name: "orphan-profile",
        value: {
          ...baseBundle,
          builds: [{ ...build, scoreProfileId: "score:missing" }],
        },
        message: "references missing scoring profile",
      },
      {
        name: "wrong-cavern-category",
        value: {
          ...baseBundle,
          builds: [
            {
              ...build,
              cavern: { mode: "four-piece", setId: build.planarSetId },
            },
          ],
        },
        message: "is not a Cavern Relic set",
      },
      {
        name: "wrong-planar-category",
        value: {
          ...baseBundle,
          builds: [{ ...build, planarSetId: cavernSetId }],
        },
        message: "is not a Planar Ornament set",
      },
      {
        name: "invalid-main-stat",
        value: {
          ...baseBundle,
          builds: [
            {
              ...build,
              preferredMainStats: {
                ...build.preferredMainStats,
                body: ["not-a-body-main-stat"],
              },
            },
          ],
        },
        message: "is not valid for its configured Relic slot",
      },
      {
        name: "unknown-character",
        value: {
          ...baseBundle,
          builds: [
            { ...build, characterDefinitionId: "character:not-in-catalog" },
          ],
        },
        message: "is not present in this reference catalog",
      },
      {
        name: "triage-threshold",
        value: {
          ...baseBundle,
          triageRules: { ...state.triageRules, keepScoreAtLeast: 101 },
        },
        message: "Every scoring and triage threshold must be between 0 and 100",
      },
    ];

    for (const testCase of cases) {
      await user.upload(
        screen.getByLabelText("Import builds"),
        new File([JSON.stringify(testCase.value)], `${testCase.name}.json`, {
          type: "application/json",
        })
      );
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(testCase.message);
      });
    }
    expect(useWorkspaceStore.getState().builds).toHaveLength(1);
  });
});
