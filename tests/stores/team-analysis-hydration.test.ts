import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { emptyTeam } from "@/domain/team/schemas";
import { DEFAULT_TEAM_STORE, TEAM_STORE_VERSION } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

afterEach(() => {
  useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
  localStorage.removeItem(STORAGE_KEYS.teams);
});

describe("analysis team persistence boundary", () => {
  it("migrates realistic v2 teams and analysis without inferring a subscription", async () => {
    const team = emptyTeam("preset:team:silver-wolf-999");
    team.name = "My saved lineup";
    team.members[0] = {
      characterId: "1506",
      eidolon: 2,
      options: {},
      skill: "prefer",
    };
    const analysisByTeamId = {
      [team.id]: {
        mode: "investment",
        investment: {
          limits: { "0:1506": { eidolon: 4, superimposition: 3 } },
          budget: "perfect",
          critMode: "crit",
        },
      },
    };
    localStorage.setItem(
      STORAGE_KEYS.teams,
      JSON.stringify({
        version: 2,
        state: {
          schemaVersion: 2,
          teams: [team],
          activeTeamId: team.id,
          analysisByTeamId,
        },
      })
    );
    await useTeamStore.persist.rehydrate();
    expect(useTeamStore.getState()).toMatchObject({
      schemaVersion: 3,
      teams: [team],
      activeTeamId: team.id,
      analysisByTeamId,
      presetSubscription: null,
    });
  });
  it("hydrates multiple v1 teams without changing authored ranks or battle setup", async () => {
    const a = emptyTeam("team:a");
    a.members[0] = {
      characterId: "1102",
      eidolon: 3,
      lightCone: { id: "23001", superimposition: 4 },
      options: { custom: { count: 2 } },
      skill: "kit",
    };
    a.enemyLevel = 90;
    a.cycles = 4;
    const b = emptyTeam("team:b");
    b.members[1] = {
      characterId: "1001",
      eidolon: 1,
      lightCone: null,
      options: {},
      skill: "prefer",
    };
    localStorage.setItem(
      STORAGE_KEYS.teams,
      JSON.stringify({
        version: 1,
        state: { schemaVersion: 1, teams: [a, b], activeTeamId: b.id },
      })
    );
    await useTeamStore.persist.rehydrate();
    expect(useTeamStore.getState().teams).toEqual([a, b]);
    expect(useTeamStore.getState().activeTeamId).toBe(b.id);
    expect(useTeamStore.getState().analysisByTeamId).toEqual({});
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.teams)!)).toMatchObject(
      {
        version: TEAM_STORE_VERSION,
        state: { schemaVersion: TEAM_STORE_VERSION, presetSubscription: null },
      }
    );
  });

  it("restores per-team mode, ceilings and an omitted automatic S through public hydration", async () => {
    const store = useTeamStore.getState();
    const a = store.createTeam();
    store.setMember(a, 0, "1102");
    store.updateMember(a, 0, { lightCone: { id: "23001" } });
    store.setAnalysisMode(a, "investment");
    const settings = {
      limits: { "0:1102": { eidolon: 4, superimposition: 2 } },
      budget: "perfect" as const,
      critMode: "crit" as const,
    };
    store.setInvestmentSettings(a, settings);
    const saved = localStorage.getItem(STORAGE_KEYS.teams)!;
    useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
    localStorage.setItem(STORAGE_KEYS.teams, saved);
    await useTeamStore.persist.rehydrate();
    expect(useTeamStore.getState().analysisByTeamId[a]).toEqual({
      mode: "investment",
      investment: settings,
    });
    expect(useTeamStore.getState().teams[0]?.members[0]?.lightCone).toEqual({
      id: "23001",
    });
    const copy = useTeamStore.getState().duplicateTeam(a)!;
    expect(useTeamStore.getState().analysisByTeamId[copy]).toEqual(
      useTeamStore.getState().analysisByTeamId[a]
    );
    useTeamStore.getState().removeTeam(a);
    expect(useTeamStore.getState().analysisByTeamId[a]).toBeUndefined();
    useTeamStore.getState().clearTeams();
    expect(useTeamStore.getState().analysisByTeamId).toEqual({});
  });

  it("recovers corrupt known data and leaves future envelopes intact", async () => {
    localStorage.setItem(
      STORAGE_KEYS.teams,
      JSON.stringify({
        version: 1,
        state: { schemaVersion: 1, teams: "broken", activeTeamId: null },
      })
    );
    await useTeamStore.persist.rehydrate();
    expect(useTeamStore.getState().teams).toEqual([]);
    const future = JSON.stringify({
      version: 99,
      state: {
        schemaVersion: 99,
        teams: [emptyTeam("team:future")],
        activeTeamId: "team:future",
      },
    });
    localStorage.setItem(STORAGE_KEYS.teams, future);
    await useTeamStore.persist.rehydrate();
    expect(useTeamStore.getState().teams).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.teams)).toBe(future);
  });
});
