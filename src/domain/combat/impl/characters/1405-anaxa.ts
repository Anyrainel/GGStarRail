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
  // Anaxa's DMG bonus against it, synced to the current action's target.
  const disclosureDmg = k.status({
    id: "qualitative-disclosure-dmg",
    origin: "talent",
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 1) }],
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

  const syncDisclosure = (ctx: BattleApi, enemy: EnemyView) => {
    if (!enemy.has(disclosure) && enemy.weaknesses.size >= k.param("04", 3)) {
      ctx.applyStatus(enemy, disclosure);
    }
  };
  // Random Type with priority to missing ones: the first missing Type. The
  // engine cannot remove Weaknesses, so the 3-turn duration is not modeled.
  const implantOne = (ctx: BattleApi, enemy: EnemyView) => {
    const missing = COMBAT_TYPES.find((type) => !enemy.weaknesses.has(type));
    if (missing) ctx.implantWeakness(enemy, missing);
    syncDisclosure(ctx, enemy);
  };

  let actionTarget: EnemyView | null = null;
  const syncDisclosureDmg = (ctx: BattleApi) => {
    if (actionTarget?.has(disclosure)) {
      ctx.applyStatus(ctx.self, disclosureDmg);
    } else {
      ctx.removeStatus(ctx.self, disclosureDmg);
    }
  };
  // Approximation: the +DMG vs "Qualitative Disclosure" follows the action's
  // main target; Bounce and AoE targets are assumed to share its state.
  k.on("actionStart", "talent", { subject: "self" }, (ctx, event) => {
    actionTarget = isEnemy(event.target) ? event.target : null;
    syncDisclosureDmg(ctx);
  });

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
    if (enemy === actionTarget) syncDisclosureDmg(ctx);
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
  // expectation. Facts give Energy (6) and Toughness (10) per instance.
  const instances = 1 + k.param("02", 2);
  const skillHits: readonly HitDef[] = [
    {
      shape: "bounce",
      each: k.param("02", 1),
      bounces: instances,
      toughness: { each: 10 },
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
      // "Sublimation": every Weakness Type. Its Crowd Control is not modeled
      // (bosses have Control RES).
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, sublimation);
        for (const type of COMBAT_TYPES) ctx.implantWeakness(enemy, type);
        syncDisclosure(ctx, enemy);
      }
      syncDisclosureDmg(ctx);
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
  });
});
