import { describe, expect, it } from "vitest";
import { simulateTeam } from "@/domain/combat/simulate";
import { type MemberInput, SCENARIO_PRESETS } from "@/domain/combat/team/input";
import { KIT_REGISTRY } from "@/lib/combat/kits";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";

function member(characterId: string): MemberInput {
  return {
    characterId,
    level: 80,
    eidolon: 0,
    traces: {},
    lightCone: null,
    relics: { stats: {}, sets: {} },
  };
}

describe("Robin reference kit", () => {
  it("raises team damage through Aria, Concerto, and Additional DMG", async () => {
    const data = await loadCombatReferenceData();
    const scenario = { ...SCENARIO_PRESETS.singleBoss, cycles: 5 };
    const solo = simulateTeam(
      { members: [member("1102")], scenario },
      data,
      KIT_REGISTRY
    );
    const duo = simulateTeam(
      { members: [member("1102"), member("1309")], scenario },
      data,
      KIT_REGISTRY
    );
    const seeleSolo = solo.report.members.find((entry) => entry.slot === 0);
    const seeleDuo = duo.report.members.find((entry) => entry.slot === 0);
    expect(seeleDuo?.damage ?? 0).toBeGreaterThan(
      (seeleSolo?.damage ?? 0) * 1.3
    );

    const ultimate = duo.log.actions.find(
      (action) =>
        action.unitId === "ally:1" && action.abilityKind === "ultimate"
    );
    expect(ultimate).toBeDefined();
    const additional = duo.log.hits.filter(
      (hit) => hit.statUnitId === "ally:1" && hit.tags.includes("additional")
    );
    expect(additional.length).toBeGreaterThan(0);
    expect(
      additional.every((hit) => hit.hit.critOverride?.critRate === 1)
    ).toBe(true);
    // Concerto ends through its countdown, and Robin acts again afterwards.
    const robinTurnsAfterUlt = duo.log.actions.filter(
      (action) =>
        action.unitId === "ally:1" &&
        action.mode === "turn" &&
        action.time > (ultimate?.time ?? 0)
    );
    expect(robinTurnsAfterUlt.length).toBeGreaterThan(0);
  });
});
