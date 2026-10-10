import { beforeAll, describe, expect, it } from "vitest";
import type { BattleApi, BattleEvent } from "@/domain/combat/kit/api";
import {
  type CharacterKitBuilder,
  defineCharacter,
} from "@/domain/combat/kit/character";
import { createKitRegistry } from "@/domain/combat/kit/registry";
import type { CombatReferenceData } from "@/domain/combat/model/data";
import { TeamObjective } from "@/domain/combat/optimize/objective";
import { simulateTeam } from "@/domain/combat/simulate";
import { SCENARIO_PRESETS, type TeamInput } from "@/domain/combat/team/input";
import { STAT_IDS } from "@/domain/stats";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";

let data: CombatReferenceData;

beforeAll(async () => {
  data = await loadCombatReferenceData();
});

// Test kits reuse real Character IDs for their catalog data.
const HUNTER = "1102";
const SUPPORT = "1309";

function run(
  build: (k: CharacterKitBuilder) => void,
  options: {
    support?: (k: CharacterKitBuilder) => void;
    enemies?: 1 | 3 | 5;
    cycles?: number;
  } = {}
) {
  const kits = createKitRegistry({
    characters: [
      defineCharacter(HUNTER, build),
      ...(options.support ? [defineCharacter(SUPPORT, options.support)] : []),
    ],
    lightCones: [],
    relicSets: [],
  });
  const member = (characterId: string) => ({
    characterId,
    level: 80,
    eidolon: 0,
    traces: {},
    lightCone: null,
    relics: { stats: {}, sets: {} },
  });
  const preset =
    options.enemies === 1
      ? SCENARIO_PRESETS.singleBoss
      : options.enemies === 5
        ? SCENARIO_PRESETS.fiveTargets
        : SCENARIO_PRESETS.bossWithAdds;
  const input: TeamInput = {
    members: [member(HUNTER), ...(options.support ? [member(SUPPORT)] : [])],
    scenario: { ...preset, cycles: options.cycles ?? 2 },
  };
  return { input, kits, result: simulateTeam(input, data, kits) };
}

const basic = (k: CharacterKitBuilder) =>
  k.ability({
    id: "basic",
    kind: "basic",
    hits: [{ shape: "single", main: 1, toughness: { main: 10 } }],
  });

describe("combat engine features", () => {
  it("reads live Skill Points inside an ability", () => {
    const seen: number[] = [];
    run((k) => {
      basic(k);
      k.ability({
        id: "skill",
        kind: "skill",
        hits: [{ shape: "single", main: 1 }],
        after: (ctx) => {
          ctx.gainSkillPoints(1);
          seen.push(ctx.skillPoints);
        },
      });
      k.policy({ turn: () => "skill", ultimate: () => false });
    });
    // 3 SP, −1 for the Skill, +1 inside `after`: the context sees 3.
    expect(seen[0]).toBe(3);
  });

  it("chains abilities when a turn does not end", () => {
    const { result } = run((k) => {
      basic(k);
      k.ability({
        id: "skill",
        kind: "skill",
        endsTurn: false,
        hits: [{ shape: "single", main: 1 }],
      });
      k.policy({
        turn: (view) =>
          view.usedThisTurn.includes("skill") ? "basic" : "skill",
        ultimate: () => false,
      });
    });
    const first = result.log.actions.slice(0, 2);
    expect(first.map((action) => action.abilityId)).toEqual(["skill", "basic"]);
    expect(first[0]?.time).toBe(first[1]?.time);
  });

  it("caps weighted triggers at their limit in expectation", () => {
    let total = 0;
    run(
      (k) => {
        basic(k);
        k.ability({
          id: "skill",
          kind: "skill",
          hits: [{ shape: "single", main: 1 }],
          after: (ctx) => {
            // Two 60% branches of one turn; the listener may fire once.
            ctx.queueAction(ctx.self, "probe", { weight: 0.6 });
            ctx.queueAction(ctx.self, "probe", { weight: 0.6 });
          },
        });
        k.ability({
          id: "probe",
          kind: "followUp",
          hits: [{ shape: "single", main: 0.1 }],
        });
        k.on(
          "actionEnd",
          "talent",
          { abilityKinds: ["followUp"], limitPerTurn: 1 },
          (ctx: BattleApi) => {
            total += ctx.weight;
          }
        );
        k.policy({ turn: () => "skill", ultimate: () => false });
      },
      { cycles: 1 }
    );
    const skills = 1;
    expect(total / skills).toBeGreaterThan(0.99);
    expect(total).toBeLessThanOrEqual(2.0001);
  });

  it("checks event predicates before limits", () => {
    let fired = 0;
    run(
      (k) => {
        basic(k);
        k.on(
          "hit",
          "talent",
          {
            limitPerAction: 1,
            when: (event: BattleEvent) => event.target?.id === "enemy:2",
          },
          () => {
            fired += 1;
          }
        );
        k.ability({
          id: "skill",
          kind: "skill",
          hits: [{ shape: "aoe", each: 1 }],
        });
        k.policy({ turn: () => "skill", ultimate: () => false });
      },
      { cycles: 1 }
    );
    expect(fired).toBeGreaterThan(0);
  });

  it("filters modifiers by the target's state at the hit", () => {
    const { result } = run(
      (k) => {
        const mark = k.status({ id: "mark", origin: "talent", debuff: true });
        k.stat("talent", {
          stat: "dmgBoost",
          value: 1,
          filter: { targetStatuses: ["mark"] },
        });
        basic(k);
        k.ability({
          id: "skill",
          kind: "skill",
          hits: [{ shape: "blast", main: 1, adjacent: 1 }],
          before: (ctx) => {
            if (ctx.target) ctx.applyStatus(ctx.target, mark);
          },
        });
        k.policy({ turn: () => "skill", ultimate: () => false });
      },
      { cycles: 1 }
    );
    const skillGroups = result.model.groups.filter(
      (group) => group.sample.abilityId === "skill"
    );
    const boosted = skillGroups.filter((group) =>
      group.constant.some((entry) => entry.stat === "dmgBoost")
    );
    expect(boosted.length).toBeGreaterThan(0);
    expect(boosted.every((group) => group.sample.role === "main")).toBe(true);
    expect(skillGroups.length).toBeGreaterThan(boosted.length);
  });

  it("splits a multiplier evenly and gives AoE main targets their own", () => {
    const { result } = run(
      (k) => {
        basic(k);
        k.ability({
          id: "skill",
          kind: "skill",
          hits: [
            { shape: "split", main: 3 },
            { shape: "aoe", main: 2, each: 1 },
          ],
        });
        k.policy({ turn: () => "skill", ultimate: () => false });
      },
      { cycles: 1 }
    );
    const first = result.log.hits.filter((hit) => hit.time === 0 || true);
    const split = first.filter((hit) => hit.hit.shape === "split");
    expect(split.slice(0, 3).map((hit) => hit.multiplier)).toEqual([1, 1, 1]);
    const aoe = first.filter((hit) => hit.hit.shape === "aoe").slice(0, 3);
    expect(aoe.find((hit) => hit.role === "main")?.multiplier).toBe(2);
    expect(
      aoe.filter((hit) => hit.role === "each").map((hit) => hit.multiplier)
    ).toEqual([1, 1]);
  });

  it("slows enemies and skips the turn of controlled enemies", () => {
    const enemyTurns = (slow: boolean, freeze: boolean) => {
      let attacks = 0;
      run(
        (k) => {
          const slowed = k.status({
            id: "slowed",
            origin: "skill",
            debuff: true,
            family: "slow",
            modifiers: [{ stat: "spdPct", value: -0.5 }],
          });
          const frozen = k.status({
            id: "frozen",
            origin: "skill",
            debuff: true,
            family: "frozen",
            skipsTurn: true,
          });
          basic(k);
          k.on(
            "battleStart",
            "talent",
            { subject: "any" },
            (ctx: BattleApi) => {
              for (const enemy of ctx.enemies) {
                if (slow) ctx.applyStatus(enemy, slowed);
                if (freeze) ctx.applyStatus(enemy, frozen, { baseChance: 0.5 });
              }
            }
          );
          k.on(
            "enemyAttack",
            "talent",
            { subject: "enemy" },
            (ctx: BattleApi) => {
              attacks += ctx.weight;
            }
          );
          k.policy({ turn: () => "basic", ultimate: () => false });
        },
        { enemies: 1, cycles: 3 }
      );
      return attacks;
    };
    const normal = enemyTurns(false, false);
    expect(enemyTurns(true, false)).toBeLessThan(normal);
    expect(enemyTurns(false, true)).toBeCloseTo(normal / 2, 6);
  });

  it("removes timed Weakness implants after the enemy's turns", () => {
    const weak: boolean[] = [];
    run(
      (k) => {
        basic(k);
        k.on("battleStart", "talent", { subject: "any" }, (ctx: BattleApi) => {
          const enemy = ctx.mainTarget;
          if (enemy) ctx.implantWeakness(enemy, "Imaginary", { turns: 1 });
        });
        k.on("turnStart", "talent", { subject: "any" }, (ctx: BattleApi) => {
          weak.push(ctx.mainTarget?.weaknesses.has("Imaginary") ?? false);
        });
        k.policy({ turn: () => "basic", ultimate: () => false });
      },
      { enemies: 1 }
    );
    expect(weak[0]).toBe(true);
    expect(weak.at(-1)).toBe(false);
  });

  it("casts Ultimate variants and pays custom Ultimate resources", () => {
    const { result } = run(
      (k) => {
        basic(k);
        k.ability({
          id: "ultimate",
          kind: "ultimate",
          hits: [{ shape: "single", main: 1 }],
        });
        k.ability({
          id: "ultimateAlt",
          kind: "ultimate",
          resource: { counter: "points", amount: 2 },
          hits: [{ shape: "single", main: 1 }],
        });
        k.on(
          "actionEnd",
          "talent",
          { abilityKinds: ["basic"] },
          (ctx: BattleApi) => ctx.addCounter(ctx.self, "points", 1)
        );
        k.policy({ turn: () => "basic", ultimate: () => "ultimateAlt" });
      },
      { cycles: 3 }
    );
    const variants = result.log.actions.filter(
      (action) => action.abilityId === "ultimateAlt"
    );
    expect(variants.length).toBeGreaterThan(0);
    expect(
      result.log.actions.some((action) => action.abilityId === "ultimate")
    ).toBe(false);
  });

  it("reports Skill Point changes and the new cap", () => {
    const changes: number[] = [];
    run(
      (k) => {
        basic(k);
        k.on("battleStart", "talent", { subject: "any" }, (ctx: BattleApi) =>
          ctx.setMaxSkillPoints(7)
        );
        k.on(
          "skillPointsChanged",
          "talent",
          { subject: "any" },
          (_ctx: BattleApi, event: BattleEvent) => {
            changes.push(event.delta ?? 0);
          }
        );
        k.policy({ turn: () => "basic", ultimate: () => false });
      },
      { cycles: 3 }
    );
    // Basic ATKs only: 3 → 7 SP, then capped.
    expect(changes.length).toBe(4);
    expect(changes.every((delta) => delta === 1)).toBe(true);
  });

  it("re-keys optimizer timelines on stats kits read in battle", () => {
    const kits = createKitRegistry({
      characters: [
        defineCharacter(HUNTER, (k) => {
          basic(k);
          k.ability({
            id: "skill",
            kind: "skill",
            hits: [{ shape: "single", main: 1 }],
          });
          // A policy reading Break Effect makes the timeline depend on it.
          k.policy({
            turn: (view) =>
              view.self.panelStat("breakEffect") > 0.5 ? "skill" : "basic",
            ultimate: () => false,
          });
        }),
      ],
      lightCones: [],
      relicSets: [],
    });
    const input: TeamInput = {
      members: [
        {
          characterId: HUNTER,
          level: 80,
          eidolon: 0,
          traces: {},
          lightCone: null,
          relics: { stats: {}, sets: {} },
        },
      ],
      scenario: { ...SCENARIO_PRESETS.singleBoss, cycles: 2 },
    };
    const objective = new TeamObjective(input, 0, data, kits);
    const low = { stats: {}, sets: {} };
    const high = { stats: { [STAT_IDS.breakEffect]: 1 }, sets: {} };
    objective.evaluate(low);
    const withBreak = objective.evaluate(high);
    const direct = simulateTeam(objective.withLoadout(high), data, kits).report
      .total;
    expect(withBreak).toBeCloseTo(direct, 6);
  });
});
