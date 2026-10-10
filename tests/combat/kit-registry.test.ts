import { beforeAll, describe, expect, it } from "vitest";
import type { CombatReferenceData } from "@/domain/combat/model/data";
import { simulateTeam } from "@/domain/combat/simulate";
import {
  type MemberInput,
  SCENARIO_PRESETS,
  type TeamInput,
} from "@/domain/combat/team/input";
import { KIT_REGISTRY } from "@/lib/combat/kits";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";

let data: CombatReferenceData;

beforeAll(async () => {
  data = await loadCombatReferenceData();
});

function member(
  characterId: string,
  overrides: Partial<MemberInput> = {}
): MemberInput {
  return {
    characterId,
    level: 80,
    eidolon: 0,
    traces: {},
    lightCone: null,
    relics: { stats: {}, sets: {} },
    ...overrides,
  };
}

/** A Robin + Kafka support pair gives triggers ("ally attacks") to react to. */
function team(main: MemberInput): TeamInput {
  const supports = ["1309", "1005"].filter((id) => id !== main.characterId);
  return {
    members: [main, ...supports.map((id) => member(id))],
    scenario: { ...SCENARIO_PRESETS.bossWithAdds, cycles: 3 },
  };
}

function expectHealthy(input: TeamInput) {
  const result = simulateTeam(input, data, KIT_REGISTRY);
  expect(result.log.warnings).toEqual([]);
  for (const group of result.model.groups) {
    const damage = result.model.evaluateGroup(group, {
      panel: (id) => result.team.units().get(id)!.panel,
    });
    expect(Number.isFinite(damage), group.sample.abilityId).toBe(true);
    expect(damage).toBeGreaterThanOrEqual(0);
  }
  return result;
}

function characterOnPath(pathId: string): string {
  const withKit = [...KIT_REGISTRY.characterIds].find(
    (id) => data.characters.get(id)?.path_id === pathId
  );
  const anyMatch = [...data.characters.values()].find(
    (character) => character.path_id === pathId
  );
  return withKit ?? anyMatch?.id ?? "1102";
}

describe("combat kit registry", () => {
  it.each([
    ...KIT_REGISTRY.characterIds,
  ])("Character %s builds and simulates at E0 and E6", (id) => {
    for (const eidolon of [0, 6]) {
      const result = expectHealthy(team(member(id, { eidolon })));
      const own = result.report.members.find((entry) => entry.slot === 0);
      expect(
        result.log.actions.some((action) => action.unitId === "ally:0")
      ).toBe(true);
      expect(own === undefined || Number.isFinite(own.damage)).toBe(true);
    }
  });

  it.each([
    ...KIT_REGISTRY.lightConeIds,
  ])("Light Cone %s applies on a matching Path at S1 and S5", (id) => {
    const lightCone = data.lightCones.get(id);
    if (!lightCone) throw new Error(`Light Cone ${id} is not in the catalog`);
    for (const superimposition of [1, 5]) {
      expectHealthy(
        team(
          member(characterOnPath(lightCone.path_id), {
            lightCone: { id, level: 80, superimposition },
          })
        )
      );
    }
  });

  it.each([
    ...KIT_REGISTRY.relicSetIds,
  ])("Relic set %s applies at every bonus tier", (id) => {
    const set = data.relicSets.get(id);
    if (!set) throw new Error(`Relic set ${id} is not in the catalog`);
    const pieces = set.kind === "planar_ornament" ? 2 : 4;
    expectHealthy(
      team(member("1102", { relics: { stats: {}, sets: { [id]: pieces } } }))
    );
  });
});
