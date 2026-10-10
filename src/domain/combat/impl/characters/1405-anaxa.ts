import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";
import type { CombatType } from "../../model/stats";

const COMBAT_TYPES: readonly CombatType[] = [
  "Physical",
  "Fire",
  "Ice",
  "Thunder",
  "Wind",
  "Quantum",
  "Imaginary",
];

/** Anaxa — Erudition, Wind. */
export default defineCharacter("1405", (k) => {
  const erudition = k.countPath("Mage");

  // "Qualitative Disclosure" marks enemies with enough Weakness Types.
  const disclosure = k.status({
    id: "qualitative-disclosure",
    origin: "talent",
  });
  const sublimation = k.status({
    id: "sublimation",
    origin: "ultimate",
    debuff: true,
    // "Lasting until the start of the targets' turn."
    duration: { turns: 1, countdown: "turnStart" },
  });
  // Stacks = enemies on the field (at most 5); the engine never removes any.
  const fractalDmg = k.status({
    id: "fractal-per-enemy",
    origin: "skill",
    maxStacks: 5,
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.param("02", 3),
        filter: { tags: ["skill"] },
      },
    ],
  });
  const e1Def = k.status({
    id: "magician-def",
    origin: "e1",
    debuff: true,
    duration: { turns: k.rankParam(1, 2) },
    modifiers: [{ stat: "defReduction", value: k.rankParam(1, 1) }],
  });
  const e2Res = k.status({
    id: "soul-true-to-history-res",
    origin: "e2",
    debuff: true,
    modifiers: [{ stat: "resReduction", value: k.rankParam(2, 1) }],
  });
  const e4Atk = k.status({
    id: "blaze-atk",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    maxStacks: k.rankParam(4, 3),
    modifiers: [{ stat: "atkPct", value: k.rankParam(4, 1) }],
  });

  k.stat("talent", {
    stat: "dmgBoost",
    value: k.param("04", 1),
    filter: { targetStatuses: [disclosure.id] },
  });

  const syncDisclosure = (ctx: BattleApi, enemy: EnemyView) => {
    const disclosed = enemy.weaknesses.size >= k.param("04", 3);
    if (disclosed && !enemy.has(disclosure)) {
      ctx.applyStatus(enemy, disclosure);
    } else if (!disclosed && enemy.has(disclosure)) {
      ctx.removeStatus(enemy, disclosure);
    }
  };
  const syncAllDisclosure = (ctx: BattleApi) => {
    for (const enemy of ctx.enemies) syncDisclosure(ctx, enemy);
  };

  // Types an enemy holds only through "Sublimation", removed when it ends.
  const sublimationOnly = new Map<EnemyView, Set<CombatType>>();
  const refreshCursor = new Map<EnemyView, number>();
  // Random Type with priority to missing ones: the first missing Type. With
  // none missing, a random held Type is refreshed; cycling through the seven
  // refreshes each as often as a random pick would.
  const implantOne = (ctx: BattleApi, enemy: EnemyView) => {
    let type = COMBAT_TYPES.find((entry) => !enemy.weaknesses.has(entry));
    if (!type) {
      const cursor = refreshCursor.get(enemy) ?? 0;
      refreshCursor.set(enemy, cursor + 1);
      type = COMBAT_TYPES[cursor % COMBAT_TYPES.length];
    }
    if (!type) return;
    ctx.implantWeakness(enemy, type, { turns: k.param("04", 2) });
    sublimationOnly.get(enemy)?.delete(type);
    syncDisclosure(ctx, enemy);
  };

  // Implants expire at the enemies' turn ends, so Anaxa re-reads the state
  // before she acts.
  k.on("actionStart", "talent", { subject: "self" }, syncAllDisclosure);

  // One implant per landed hit: expected (Bounce) hit counts accumulate per
  // enemy and implant at the nearest whole hit.
  const expectedHits = new Map<EnemyView, number>();
  const implants = new Map<EnemyView, number>();
  k.on("hit", "talent", { subject: "self" }, (ctx, event) => {
    const enemy = event.target;
    if (!isEnemy(enemy)) return;
    const total = (expectedHits.get(enemy) ?? 0) + event.weight;
    expectedHits.set(enemy, total);
    let done = implants.get(enemy) ?? 0;
    while (done + 0.5 <= total + 1e-9) {
      done += 1;
      implantOne(ctx, enemy);
    }
    implants.set(enemy, done);
    syncDisclosure(ctx, enemy);
  });

  k.on("statusRemoved", "ultimate", { status: sublimation }, (ctx, event) => {
    const enemy = event.target;
    if (!isEnemy(enemy)) return;
    for (const type of sublimationOnly.get(enemy) ?? []) {
      ctx.removeWeakness(enemy, type);
    }
    sublimationOnly.delete(enemy);
    syncDisclosure(ctx, enemy);
  });

  k.on("battleStart", "skill", { subject: "any" }, (ctx) => {
    ctx.applyStatus(ctx.self, fractalDmg, {
      setStacks: ctx.enemies.length,
    });
    for (const enemy of ctx.enemies) {
      if (k.e(2)) {
        implantOne(ctx, enemy);
        ctx.applyStatus(enemy, e2Res);
      }
      syncDisclosure(ctx, enemy);
    }
  });

  k.on("turnStart", "talent", { subject: "self" }, syncAllDisclosure);
  if (k.a(1)) {
    k.on("turnStart", "a2", { subject: "self" }, (ctx) => {
      if (!ctx.enemies.some((enemy) => enemy.has(disclosure))) {
        ctx.gainEnergy(ctx.self, k.traceParam(1, 2));
      }
    });
  }
  if (k.a(2)) {
    if (k.e(6) || erudition === 1) {
      k.stat("a4", { stat: "critDmg", value: k.traceParam(2, 1) });
    }
    if (k.e(6) || erudition >= 2) {
      k.teamStat("a4", { stat: "dmgBoost", value: k.traceParam(2, 2) });
    }
  }
  if (k.a(3)) {
    // One modifier per Type: the DEF ignored grows with each Weakness held.
    for (const type of COMBAT_TYPES) {
      k.stat("a6", {
        stat: "defIgnore",
        value: k.traceParam(3, 1),
        filter: { targetWeakness: [type] },
      });
    }
  }
  if (k.e(6)) {
    k.stat("e6", { stat: "dmgMultiplier", value: k.rankParam(6, 1) - 1 });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    energy: 20 + (k.a(1) ? k.traceParam(1, 1) : 0),
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // 1 targeted hit plus 4 Bounces preferring unhit enemies spreads the 5
  // instances evenly over up to 5 enemies, so one even Bounce is exact in
  // expectation. Facts give Energy (6) per instance. Toughness is 10 for the
  // designated hit and 5 per extra instance (fribbels), averaged over the
  // even Bounce: (10 + 4 x 5) / 5 = 6.
  const instances = 1 + k.param("02", 2);
  const skillHits: readonly HitDef[] = [
    {
      shape: "bounce",
      each: k.param("02", 1),
      bounces: instances,
      toughness: { each: 6 },
    },
  ];
  const beforeSkill = (ctx: ActionContext) => {
    if (k.e(4)) ctx.applyStatus(ctx.self, e4Atk);
  };
  k.ability({
    id: "skill",
    kind: "skill",
    energy: 6 * instances,
    before: beforeSkill,
    hits: skillHits,
  });
  // The Talent's extra Skill: same Skill, no Skill Point, no re-trigger.
  k.ability({
    id: "additionalSkill",
    kind: "skill",
    skillPoints: 0,
    energy: 6 * instances,
    before: beforeSkill,
    hits: skillHits,
  });

  k.on(
    "actionEnd",
    "talent",
    { subject: "self", abilityKinds: ["basic", "skill"] },
    (ctx, event) => {
      if (event.abilityId === "additionalSkill") return;
      const target = event.target;
      if (!isEnemy(target) || !target.has(disclosure)) return;
      ctx.queueAction(ctx.self, "additionalSkill", { target });
    }
  );

  if (k.e(1)) {
    k.on(
      "hit",
      "e1",
      { subject: "self", abilityKinds: ["skill"] },
      (ctx, event) => {
        if (isEnemy(event.target)) ctx.applyStatus(event.target, e1Def);
      }
    );
    k.on(
      "actionEnd",
      "e1",
      { subject: "self", abilityKinds: ["skill"] },
      (ctx) => {
        if (ctx.self.counter("e1-first-skill") > 0) return;
        ctx.setCounter(ctx.self, "e1-first-skill", 1);
        ctx.gainSkillPoints(k.rankParam(1, 3));
      }
    );
  }

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      // "Sublimation": every Weakness Type until the enemy's turn starts. Its
      // Crowd Control is not modeled (bosses have Control RES).
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, sublimation);
        const added = sublimationOnly.get(enemy) ?? new Set<CombatType>();
        for (const type of COMBAT_TYPES) {
          if (enemy.weaknesses.has(type)) continue;
          ctx.implantWeakness(enemy, type);
          added.add(type);
        }
        sublimationOnly.set(enemy, added);
        syncDisclosure(ctx, enemy);
      }
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
  });
});
