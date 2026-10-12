import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import {
  DEFAULT_TEAM_STORE,
  PersistedTeamStoreSchema,
  TEAM_STORE_VERSION,
} from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

function ids(): string[] {
  return useTeamStore.getState().teams.map((team) => team.id);
}

afterEach(() => {
  useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
});

describe("team store list actions", () => {
  it("returns the duplicated team identity even if a subscriber restores the URL selection", () => {
    const source = useTeamStore.getState().createTeam();
    const unsubscribe = useTeamStore.subscribe((state, previous) => {
      if (state.teams.length > previous.teams.length) {
        useTeamStore.getState().setActiveTeam(source);
      }
    });
    try {
      const copy = useTeamStore.getState().duplicateTeam(source);
      expect(copy).toBe(ids()[1]);
      expect(copy).not.toBe(source);
      expect(useTeamStore.getState().activeTeamId).toBe(source);
      expect(useTeamStore.getState().duplicateTeam("team:missing")).toBeNull();
    } finally {
      unsubscribe();
    }
  });
  it("creates teams at the end by default and at the start on request", () => {
    const { createTeam } = useTeamStore.getState();
    const first = createTeam();
    const last = createTeam("end");
    const start = createTeam("start");
    expect(ids()).toEqual([start, first, last]);
    expect(useTeamStore.getState().activeTeamId).toBe(start);
  });

  it("moves a team to a clamped index and ignores unknown teams", () => {
    const { createTeam, moveTeam } = useTeamStore.getState();
    const a = createTeam();
    const b = createTeam();
    const c = createTeam();
    moveTeam(c, 0);
    expect(ids()).toEqual([c, a, b]);
    moveTeam(c, 1);
    expect(ids()).toEqual([a, c, b]);
    moveTeam(a, 99);
    expect(ids()).toEqual([c, b, a]);
    moveTeam(a, -4);
    expect(ids()).toEqual([a, c, b]);
    const before = useTeamStore.getState().teams;
    moveTeam("team:missing", 0);
    expect(useTeamStore.getState().teams).toBe(before);
  });

  it("clears every team and the active selection", () => {
    const { createTeam, clearTeams } = useTeamStore.getState();
    createTeam();
    createTeam();
    clearTeams();
    expect(useTeamStore.getState().teams).toEqual([]);
    expect(useTeamStore.getState().activeTeamId).toBeNull();
  });

  it("keeps the persisted shape and version", () => {
    const { createTeam, moveTeam, setMember } = useTeamStore.getState();
    const a = createTeam();
    const b = createTeam("start");
    setMember(a, 0, "1102");
    moveTeam(a, 0);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.teams) ?? "{}");
    expect(stored.version).toBe(TEAM_STORE_VERSION);
    const parsed = PersistedTeamStoreSchema.parse(stored.state);
    expect(parsed.teams.map((team) => team.id)).toEqual([a, b]);
    expect(Object.keys(stored.state).sort()).toEqual([
      "activeTeamId",
      "analysisByTeamId",
      "schemaVersion",
      "teams",
    ]);
  });
});

describe("team store member actions", () => {
  it("removes a member and moves later members up", () => {
    const { createTeam, setMember, updateMember, removeMember } =
      useTeamStore.getState();
    const id = createTeam();
    setMember(id, 0, "1102");
    setMember(id, 1, "1309");
    setMember(id, 2, "1005");
    updateMember(id, 2, { eidolon: 2 });
    removeMember(id, 1);
    const members = useTeamStore.getState().teams[0]?.members ?? [];
    expect(members.map((member) => member?.characterId ?? null)).toEqual([
      "1102",
      "1005",
      null,
      null,
    ]);
    expect(members[1]?.eidolon).toBe(2);
    expect(members).toHaveLength(4);
  });
});
