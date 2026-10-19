import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartupDialogs } from "@/app/StartupDialogs";
import { STORAGE_KEYS } from "@/config/identity";
import { APP_PATHS } from "@/config/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import * as presets from "@/services/builds/presets";
import { updateLogs } from "@/services/content/updateLog";
import { useGreetingStore } from "@/stores/useGreetingStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function renderStartup(path: string = APP_PATHS.home) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <StartupDialogs />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  useWorkspaceStore.getState().clearWorkspace();
  useGreetingStore.setState({ buildPromptSeen: false, lastSeenUpdate: null });
});

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
  vi.restoreAllMocks();
});

describe("startup build and update dialogs", () => {
  it("reviews separate Cavern/Planar presets before subscribing and suppresses simultaneous news", async () => {
    const user = userEvent.setup();
    const load = vi.spyOn(presets, "loadBuildPreset");
    renderStartup();
    expect(
      screen.getByRole("dialog", { name: "Choose your Relic builds" })
    ).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Latest update" })).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().builds).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Review preset" }));
    await screen.findByRole("button", { name: "Subscribe to preset" });
    expect(screen.getByText("Cavern Relics · 4 slots")).toBeVisible();
    expect(screen.getByText("Planar Ornaments · 2 slots")).toBeVisible();
    expect(useWorkspaceStore.getState().builds).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "Subscribe to preset" })
    );
    const state = useWorkspaceStore.getState();
    expect(state.buildPresetSubscription?.presetId).toBe("in-game");
    expect(state.builds.some((build) => build.category === "cavern")).toBe(
      true
    );
    expect(state.builds.some((build) => build.category === "planar")).toBe(
      true
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useGreetingStore.getState().lastSeenUpdate).toBe(
      updateLogs.en.entries[0]?.date
    );
  });

  it.each([
    APP_PATHS.recommendations,
    APP_PATHS.evaluation,
    APP_PATHS.resources,
    APP_PATHS.triage,
    APP_PATHS.filters,
  ])("prompts for missing builds at %s", (path) => {
    renderStartup(path);
    expect(
      screen.getByRole("dialog", { name: "Choose your Relic builds" })
    ).toBeVisible();
  });

  it("remembers a dismissal through public hydration and does not reopen on another feature", async () => {
    const first = renderStartup();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    first.unmount();
    useGreetingStore.setState({ buildPromptSeen: false, lastSeenUpdate: null });
    localStorage.setItem(
      STORAGE_KEYS.greeting,
      JSON.stringify({
        version: 1,
        state: {
          buildPromptSeen: true,
          lastSeenUpdate: updateLogs.en.entries[0]?.date,
        },
      })
    );
    await useGreetingStore.persist.rehydrate();
    renderStartup(APP_PATHS.triage);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useWorkspaceStore.getState().builds).toHaveLength(0);
  });

  it("preserves custom scoring, Light Cone choices and triage rules when no builds exist", () => {
    useWorkspaceStore.setState({
      characterLightConeIds: { "1001": ["20000"] },
    });
    const first = renderStartup();
    expect(
      screen.queryByRole("dialog", { name: "Choose your Relic builds" })
    ).toBeNull();
    expect(useWorkspaceStore.getState().characterLightConeIds).toEqual({
      "1001": ["20000"],
    });
    first.unmount();
    useWorkspaceStore.setState({
      characterLightConeIds: {},
      triageRules: {
        ...useWorkspaceStore.getState().triageRules,
        protectLocked: false,
      },
    });
    useGreetingStore.setState({ buildPromptSeen: false });
    renderStartup();
    expect(
      screen.queryByRole("dialog", { name: "Choose your Relic builds" })
    ).toBeNull();
    expect(useWorkspaceStore.getState().triageRules.protectLocked).toBe(false);
  });

  it("keeps a custom score profile even when no builds reference it yet", async () => {
    const preset = await presets.loadInGameBuildPreset();
    const profile = preset.scoreProfiles[0]!;
    useWorkspaceStore.setState({ scoreProfiles: [profile] });
    renderStartup(APP_PATHS.recommendations);
    expect(
      screen.queryByRole("dialog", { name: "Choose your Relic builds" })
    ).toBeNull();
    expect(useWorkspaceStore.getState().scoreProfiles).toEqual([profile]);
    expect(useWorkspaceStore.getState().builds).toHaveLength(0);
  });

  it("does not replace configuration imported while a preset preview is open", async () => {
    const user = userEvent.setup();
    renderStartup();
    await user.click(screen.getByRole("button", { name: "Review preset" }));
    await screen.findByRole("button", { name: "Subscribe to preset" });
    const preset = await presets.loadInGameBuildPreset();
    act(() =>
      useWorkspaceStore.setState({ scoreProfiles: [preset.scoreProfiles[0]!] })
    );
    expect(
      screen.queryByRole("dialog", { name: "Choose your Relic builds" })
    ).toBeNull();
    expect(useWorkspaceStore.getState().buildPresetSubscription).toBeNull();
    expect(useWorkspaceStore.getState().builds).toHaveLength(0);
    expect(useWorkspaceStore.getState().scoreProfiles).toEqual([
      preset.scoreProfiles[0]!,
    ]);
  });

  it("reports a preset load failure and can retry without changing the workspace", async () => {
    const user = userEvent.setup();
    vi.spyOn(presets, "loadBuildPreset").mockRejectedValueOnce(
      new Error("network failure")
    );
    renderStartup();
    await user.click(screen.getByRole("button", { name: "Review preset" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load the preset"
    );
    expect(useWorkspaceStore.getState().builds).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Review preset" }));
    expect(
      await screen.findByRole("button", { name: "Subscribe to preset" })
    ).toBeEnabled();
  });

  it("shows only the latest unread entry and opens complete history in the side sheet", async () => {
    const user = userEvent.setup();
    useGreetingStore.setState({
      buildPromptSeen: true,
      lastSeenUpdate: "2026-01-01",
    });
    renderStartup(APP_PATHS.characters);
    const latest = updateLogs.en.entries[0]!;
    expect(
      screen.getByRole("dialog", { name: "Latest update" })
    ).toHaveTextContent(latest.date);
    expect(screen.queryByText(updateLogs.en.entries[1]!.date)).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Full update history" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Latest update" })).toBeNull()
    );
    expect(
      screen.getByRole("dialog", { name: "What’s New" })
    ).toHaveTextContent(updateLogs.en.entries[1]!.date);
    expect(useGreetingStore.getState().lastSeenUpdate).toBe(latest.date);
  });

  it("does not interrupt authentication callbacks", () => {
    renderStartup("/callback");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
