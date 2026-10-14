import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildWorkspaceActions } from "@/components/builds/BuildWorkspaceActions";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadInGameBuildPreset } from "@/services/builds/presets";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
  vi.restoreAllMocks();
});

describe("build preset import", () => {
  it("rejects unknown catalog references hidden in a subscribed file baseline", async () => {
    const errorToast = vi.spyOn(toast, "error");
    const references = await loadBuildReferences();
    const preset = await loadInGameBuildPreset();
    useWorkspaceStore.getState().subscribeBuildPreset("in-game", preset);
    const subscription = structuredClone(
      useWorkspaceStore.getState().buildPresetSubscription!
    );
    subscription.baseline.builds[0]!.characterDefinitionId =
      "unknown-character";
    const file = new File(
      [JSON.stringify({ ...preset, buildPresetSubscription: subscription })],
      "subscribed-builds.json",
      { type: "application/json" }
    );
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <I18nProvider>
          <MemoryRouter>
            <BuildWorkspaceActions references={references} />
          </MemoryRouter>
        </I18nProvider>
      </ThemeProvider>
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(
      screen.getByLabelText("Import builds", { selector: "input" }),
      { target: { files: [file] } }
    );
    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(
        expect.stringContaining("unknown-character")
      )
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Review build workspace import" })
    ).toBeNull();
    expect(useWorkspaceStore.getState().builds).toEqual(preset.builds);
  });

  it("opens preset selection first and requires review before replacing builds", async () => {
    const references = await loadBuildReferences();
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, "click");
    render(
      <ThemeProvider>
        <I18nProvider>
          <MemoryRouter>
            <BuildWorkspaceActions references={references} />
          </MemoryRouter>
        </I18nProvider>
      </ThemeProvider>
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(click).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Import from file" })
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "In-Game Recommended Builds" })
    );
    expect(
      await screen.findByRole("heading", {
        name: "Review build workspace import",
      })
    ).toBeVisible();
    expect(useWorkspaceStore.getState().builds).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "Subscribe to preset" })
    );
    const preset = await loadInGameBuildPreset();
    await waitFor(() =>
      expect(useWorkspaceStore.getState().builds).toEqual(preset.builds)
    );
    expect(useWorkspaceStore.getState().scoreProfiles).toEqual(
      preset.scoreProfiles
    );
    expect(useWorkspaceStore.getState().characterLightConeIds).toEqual(
      preset.characterLightConeIds
    );
    expect(useWorkspaceStore.getState().buildPresetSubscription?.presetId).toBe(
      "in-game"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(
      screen.getByRole("button", {
        name: "In-Game Recommended Builds Subscribed",
      })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Stop subscription" }));
    expect(useWorkspaceStore.getState().buildPresetSubscription).toBeNull();
    expect(useWorkspaceStore.getState().builds).toEqual(preset.builds);
  });
});
