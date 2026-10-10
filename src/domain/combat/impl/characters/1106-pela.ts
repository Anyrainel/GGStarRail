import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Pela — Nihility, Ice. */
export default defineCharacter("1106", (k) => {
  const exposed = k.status({
    id: "exposed",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 3) },
    modifiers: [{ stat: "defReduction", value: k.param("03", 2) }],
  });

  const iceResDown = k.status({
    id: "full-analysis",
    origin: "e4",
    debuff: true,
    duration: { turns: k.rankParam(4, 3) },
    modifiers: [
      {
        stat: "resReduction",
        value: k.rankParam(4, 2),
        filter: { combatTypes: ["Ice"] },
      },
    ],
  });

  // A2: the Engine has no target-state filter, so the bonus is synced to the
  // enemy each hit is aimed at before it lands.
  const bash = k.status({
    id: "bash",
    origin: "a2",
    modifiers: [{ stat: "dmgBoost", value: k.traceParam(1, 1) }],
  });
  const aim = (ctx: BattleApi, enemy: EnemyView | null) => {
    if (!k.a(1)) return;
    if (enemy && enemy.debuffCount() > 0) {
      if (!ctx.self.has(bash)) ctx.applyStatus(ctx.self, bash);
    } else {
      ctx.removeStatus(ctx.self, bash);
    }
  };

  if (k.a(2)) {
    k.teamStat("a4", { stat: "effectHitRate", value: k.traceParam(2, 1) });
  }

  // Enemy buffs are not simulated: whether the Skill dispels one is a user
  // condition. It gates A6, E2, and the turn policy.
  const dispel = k.toggle("dispel", "skill", "active", false);
  // Kills are not simulated; when on, each Ultimate is assumed to defeat one.
  const ultimateKill = k.e(1) && k.toggle("e1-kill", "e1", "enemyDefeated", false);

  const wipeOut = k.status({
    id: "wipe-out",
    origin: "a6",
    modifiers: [{ stat: "dmgBoost", value: k.traceParam(3, 1) }],
  });
  if (k.a(3) && dispel) {
    // "Next attack": consume first, then grant, so the Skill that dispels
    // does not consume its own bonus.
    k.on("actionEnd", "a6", { subject: "self", attack: true }, (ctx) =>
      ctx.removeStatus(ctx.self, wipeOut)
    );
    k.on(
      "actionEnd",
      "a6",
      { subject: "self", abilityKinds: ["skill"] },
      (ctx) => ctx.applyStatus(ctx.self, wipeOut)
    );
  }

  const adamantCharge = k.status({
    id: "adamant-charge",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "spdPct", value: k.rankParam(2, 1) }],
  });

  const afterAttack = (ctx: ActionContext, targets: readonly EnemyView[]) => {
    const debuffed = targets.filter((enemy) => enemy.debuffCount() > 0);
    if (debuffed.length > 0) ctx.gainEnergy(ctx.self, k.param("04", 1));
    if (!k.e(6)) return;
    // For the AoE Ultimate, every debuffed enemy hit counts as "the enemy
    // target" (tracked as verify).
    for (const enemy of debuffed) {
      aim(ctx, enemy);
      ctx.deal(
        { shape: "single", main: k.rankParam(6, 1), onlyTags: ["additional"] },
        { targets: [enemy], origin: "e6" }
      );
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    before: (ctx) => aim(ctx, isEnemy(ctx.target) ? ctx.target : null),
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) afterAttack(ctx, [ctx.target]);
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      if (k.e(4)) {
        ctx.applyStatus(ctx.target, iceResDown, {
          baseChance: k.rankParam(4, 1),
        });
      }
      aim(ctx, ctx.target);
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (dispel && k.e(2)) ctx.applyStatus(ctx.self, adamantCharge);
      if (isEnemy(ctx.target)) afterAttack(ctx, [ctx.target]);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    // ZH lists Exposed before the DMG ("同时"): the DEF reduction applies to
    // this Ultimate's own hits.
    before: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, exposed, { baseChance: k.param("03", 1) });
      }
      aim(ctx, isEnemy(ctx.target) ? ctx.target : null);
    },
    hits: [{ shape: "aoe", each: k.param("03", 4), toughness: { each: 20 } }],
    after: (ctx) => {
      afterAttack(ctx, ctx.enemies);
      if (ultimateKill) ctx.gainEnergy(ctx.self, k.rankParam(1, 1));
    },
  });

  // Pela banks Skill Points with Basic ATK; her Skill is for dispelling.
  k.policy({
    turn: (view) => (dispel && view.skillPoints >= 1 ? "skill" : "basic"),
  });
});
