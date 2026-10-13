import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { emptyTeam } from "@/domain/team/schemas";
import { DEFAULT_TEAM_STORE } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

afterEach(() => {
  useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
  localStorage.removeItem(STORAGE_KEYS.teams);
});

describe("whole-file team preset subscriptions", () => {
  it("updates untouched rows and file order, adding new rows and dropping upstream removals", () => {
    const store = useTeamStore.getState();
    const first = [emptyTeam("a"), emptyTeam("b"), emptyTeam("c")];
    store.subscribePreset("test-file", first);
    const next = [{ ...first[1]!, cycles: 6 }, emptyTeam("d"), first[0]!];
    store.hydratePreset("test-file", next);
    expect(useTeamStore.getState().teams).toEqual(next);
    expect(useTeamStore.getState().presetSubscription?.baseline).toEqual(next);
  });
  it("preserves edits, deleted rows, custom additions and authored order across hydration", async () => {
    const store = useTeamStore.getState();
    const baseline = [
      emptyTeam("a"),
      emptyTeam("b"),
      emptyTeam("c"),
      emptyTeam("d"),
    ];
    store.subscribePreset("test-file", baseline);
    store.renameTeam("a", "My name");
    store.removeTeam("b");
    store.moveTeam("c", 0);
    store.setAnalysisMode("a", "investment");
    const custom = store.createTeam();
    const saved = localStorage.getItem(STORAGE_KEYS.teams)!;
    useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
    localStorage.setItem(STORAGE_KEYS.teams, saved);
    await useTeamStore.persist.rehydrate();
    const next = [
      { ...baseline[0]!, cycles: 7 },
      baseline[1]!,
      { ...baseline[2]!, enemyLevel: 110 },
      emptyTeam("new"),
    ];
    useTeamStore.getState().hydratePreset("test-file", next);
    const current = useTeamStore.getState();
    expect(current.teams.map((team) => team.id)).toEqual([
      "c",
      "a",
      custom,
      "new",
    ]);
    expect(current.teams.find((team) => team.id === "a")).toMatchObject({
      name: "My name",
      cycles: 3,
    });
    expect(current.teams[0]?.enemyLevel).toBe(110);
    expect(current.analysisByTeamId.a?.mode).toBe("investment");
    expect(current.presetSubscription?.deletedTeamIds).toContain("b");
    current.hydratePreset("test-file", [next[0]!, next[2]!]);
    current.hydratePreset("test-file", [...next]);
    expect(useTeamStore.getState().teams.some((team) => team.id === "b")).toBe(
      false
    );
  });
  it("keeps edited upstream removals, stops subscription without deleting plans, and ignores stale loads", () => {
    const store = useTeamStore.getState();
    store.subscribePreset("old", [emptyTeam("a")]);
    store.updateTeam("a", { cycles: 5 });
    store.hydratePreset("old", []);
    expect(useTeamStore.getState().teams[0]?.cycles).toBe(5);
    store.subscribePreset("new", [emptyTeam("b")]);
    store.hydratePreset("old", [emptyTeam("c")]);
    expect(useTeamStore.getState().teams.map((team) => team.id)).toEqual(["b"]);
    store.stopPresetSubscription();
    expect(useTeamStore.getState().presetSubscription).toBeNull();
    expect(useTeamStore.getState().teams.map((team) => team.id)).toEqual(["b"]);
  });
});
