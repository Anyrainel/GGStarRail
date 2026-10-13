import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHydrateBuildPreset } from "@/hooks/useHydrateBuildPreset";
import {
  loadBuildPreset,
  loadInGameBuildPreset,
} from "@/services/builds/presets";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

vi.mock("@/services/builds/presets", async (original) => ({
  ...(await original<typeof import("@/services/builds/presets")>()),
  loadBuildPreset: vi.fn(),
}));
afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
  vi.clearAllMocks();
});

describe("preset bootstrap", () => {
  it("retains the last resolved workspace when loading fails and retries the subscription", async () => {
    const preset = await loadInGameBuildPreset();
    act(() =>
      useWorkspaceStore.getState().subscribeBuildPreset("in-game", preset)
    );
    vi.mocked(loadBuildPreset).mockRejectedValueOnce(
      new Error("Missing preset")
    );
    const { result } = renderHook(() => useHydrateBuildPreset());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(useWorkspaceStore.getState().builds).toEqual(preset.builds);
    const next = structuredClone(preset);
    next.builds[0]!.name = "Updated preset";
    vi.mocked(loadBuildPreset).mockResolvedValueOnce(next);
    act(() => result.current.retry());
    await waitFor(() =>
      expect(useWorkspaceStore.getState().builds[0]!.name).toBe(
        "Updated preset"
      )
    );
    expect(result.current.failed).toBe(false);
  });
});
