import { describe, expect, it } from "vitest";
import { simulateTeam } from "@/domain/combat/simulate";
import { SCENARIO_PRESETS, type TeamInput } from "@/domain/combat/team/input";
import { KIT_REGISTRY } from "@/lib/combat/kits";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";

function seeleTeam(): TeamInput {
  return {
    members: [
      {
        characterId: "1102",
        level: 80,
        eidolon: 0,
        traces: {},
        lightCone: null,
        relics: { stats: {}, sets: {} },
      },
    ],
    scenario: { ...SCENARIO_PRESETS.singleBoss, cycles: 1 },
  };
}

describe("Seele reference kit", () => {
  it("matches a hand-computed Skill hit at level 80", async () => {
    const data = await loadCombatReferenceData();
    const seele = data.characters.get("1102");
    if (!seele) throw new Error("Missing Seele");
    const result = simulateTeam(seeleTeam(), data, KIT_REGISTRY);

    const firstAction = result.log.actions[0];
    expect(firstAction?.abilityId).toBe("skill");
    const skillGroup = result.model.groups.find(
      (group) =>
        group.sample.abilityId === "skill" && group.sample.kind === "direct"
    );
    if (!skillGroup) throw new Error("Missing Skill hits");
    const perHit =
      result.model.evaluateGroup(skillGroup, {
        panel: (id) => result.team.units().get(id)!.panel,
      }) / skillGroup.records.length;

    const scaling = seele.stat_scaling.find((row) => row.ascension === 6);
    const atkBase =
      (scaling?.stats.attack.base_value ?? 0) +
      (scaling?.stats.attack.level_add ?? 0) * 79;
    const atk = atkBase * (1 + 0.28);
    const multiplier = seele.skills.find((skill) => skill.id === "110202")
      ?.levels[9]?.parameters[0];
    const crit = 1 + 0.05 * (0.5 + 0.24);
    const def = 100 / (95 + 20 + 100);
    // The first Skill lands before Amplification and on an unbroken target.
    expect(perHit).toBeCloseTo(atk * (multiplier ?? 0) * crit * def * 0.9, 6);
  });

  it("applies the Skill SPD Boost and the Ultimate's Amplification", async () => {
    const data = await loadCombatReferenceData();
    const result = simulateTeam(
      {
        ...seeleTeam(),
        scenario: { ...SCENARIO_PRESETS.singleBoss, cycles: 3 },
      },
      data,
      KIT_REGISTRY
    );
    const ultimate = result.log.actions.find(
      (action) => action.abilityKind === "ultimate"
    );
    expect(ultimate).toBeDefined();
    const amplified = result.log.hits.find((hit) =>
      hit.attackerModifiers.some((modifier) => modifier.def.stat === "dmgBoost")
    );
    expect(amplified).toBeDefined();
    // 115 SPD: about four turns across 350 AV, more with the SPD Boost.
    const turns = result.log.actions.filter((action) => action.mode === "turn");
    expect(turns.length).toBeGreaterThanOrEqual(4);
    expect(result.report.total).toBeGreaterThan(0);
  });
});
