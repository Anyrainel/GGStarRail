import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyTeam, TeamMemberPlanSchema } from "@/domain/team/schemas";
import { useHydrateTeamPreset } from "@/hooks/useHydrateTeamPreset";
import { loadTeamPreset } from "@/services/teams/presets";
import { useTeamStore } from "@/stores/useTeamStore";

vi.mock("@/services/teams/presets", async (original) => ({
  ...(await original<typeof import("@/services/teams/presets")>()),
  loadTeamPreset: vi.fn(),
}));
afterEach(() => {
  act(() => useTeamStore.getState().clearTeams());
  vi.clearAllMocks();
});

function preset(characterId = "1102") {
  const team = emptyTeam("a");
  team.members[0] = TeamMemberPlanSchema.parse({ characterId });
  return {
    schema: "ggstarrail.team-preset" as const,
    schemaVersion: 1 as const,
    id: "test",
    name: { en: "Test", "zh-CN": "测试" },
    teams: [team],
  };
}

describe("team subscription bootstrap", () => {
  it("retains resolved teams on load failure and retries the file", async () => {
    const initial = preset();
    act(() => useTeamStore.getState().subscribePreset("test", initial.teams));
    vi.mocked(loadTeamPreset).mockRejectedValueOnce(new Error("Missing file"));
    const { result } = renderHook(() => useHydrateTeamPreset());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(useTeamStore.getState().teams).toEqual(initial.teams);
    const updated = preset();
    updated.teams[0]!.cycles = 6;
    vi.mocked(loadTeamPreset).mockResolvedValueOnce(updated);
    act(() => result.current.retry());
    await waitFor(() =>
      expect(useTeamStore.getState().teams[0]?.cycles).toBe(6)
    );
    expect(result.current.failed).toBe(false);
  });
  it("retains resolved teams when the new file has unknown catalog references", async () => {
    const initial = preset();
    act(() => useTeamStore.getState().subscribePreset("test", initial.teams));
    vi.mocked(loadTeamPreset).mockResolvedValueOnce(preset("unknown"));
    const { result } = renderHook(() => useHydrateTeamPreset());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(useTeamStore.getState().teams).toEqual(initial.teams);
    expect(useTeamStore.getState().presetSubscription?.baseline).toEqual(
      initial.teams
    );
  });
});
