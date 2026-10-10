import {
  type BattleApi,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Topaz & Numby — The Hunt, Fire. */
export default defineCharacter("1112", (k) => {
  const NUMBY_TURN = "numby-turn";
  const WINDFALL_ATTACKS = "windfall-attacks";
  // Per-action latches for "receives a Follow-Up ATK" style triggers.
  const FOLLOW_UP_LATCH = "debt-follow-up";
  const WINDFALL_LATCH = "debt-windfall";

  const proofOfDebt = k.status({
    id: "proof-of-debt",
    origin: "skill",
    debuff: true,
    modifiers: [
      {
        stat: "vulnerability",
        value: k.param("02", 2),
        filter: { tags: ["followUp"] },
      },
    ],
  });
  // Numby attacks with Topaz's stats, so its buffs sit on Topaz, scoped to
  // the summon. The Skill's DMG is dealt by Numby (the game adds the
  // Windfall Bonanza! multiplier to it and counts it as one of its attacks).
  // The multiplier increase is part of the hits (see numbyHits).
  const windfall = k.status({
    id: "windfall-bonanza",
    origin: "ultimate",
    modifiers: [
      {
        stat: "critDmg",
        value: k.param("03", 2),
        filter: { attackerKinds: ["summon"] },
      },
    ],
  });
  // E1 Debtor: one status per stack (only the first is the debuff), so
  // allies' Follow-Up CRIT DMG can follow the target's stacks.
  const debtorStacks = Array.from({ length: k.rankParam(1, 2) }, (_, index) =>
    k.status({
      id: `debtor-${index + 1}`,
      origin: "e1",
      debuff: index === 0,
    })
  );
  if (k.e(1)) {
    for (const stack of debtorStacks) {
      k.teamStat("e1", {
        stat: "critDmg",
        value: k.rankParam(1, 1),
        filter: { tags: ["followUp"], targetStatuses: [stack.id] },
      });
    }
  }

  if (k.a(2)) {
    k.stat("a4", {
      stat: "dmgBoost",
      value: k.traceParam(2, 1),
      filter: { targetWeakness: ["Fire"] },
    });
  }
  if (k.e(6)) {
    k.stat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 2),
      filter: { attackerKinds: ["summon"], combatTypes: ["Fire"] },
    });
  }

  const debtTarget = (enemies: readonly EnemyView[]) =>
    enemies.find((enemy) => enemy.has(proofOfDebt));
  const removeDebt = (ctx: BattleApi, enemy: EnemyView) => {
    ctx.removeStatus(enemy, proofOfDebt);
    for (const stack of debtorStacks) ctx.removeStatus(enemy, stack);
  };

  // "A random enemy": the engine's main target, which the Skill also marks.
  const ensureDebt = (ctx: BattleApi) => {
    if (debtTarget(ctx.enemies)) return;
    const target = ctx.enemies[Math.floor((ctx.enemies.length - 1) / 2)];
    if (target) ctx.applyStatus(target, proofOfDebt);
  };
  k.on("turnStart", "skill", { subject: "ally" }, ensureDebt);
  k.on("actionStart", "skill", { subject: "ally" }, ensureDebt);

  k.ability({
    id: "basic",
    kind: "basic",
    tags: k.a(1) ? ["basic", "followUp"] : ["basic"],
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // Numby's attacks (and the Skill's DMG) land in 7 equal hits, or in
  // Windfall Bonanza! in 8 hits of 7 × 10% + 30% of the increased
  // multiplier (the game's ability config); Toughness splits the same way.
  const numbyHits = (topaz: UnitView, multiplier: number): HitDef[] => {
    const boosted = topaz.has(windfall);
    const total = multiplier + (boosted ? k.param("03", 1) : 0);
    const shares = boosted
      ? [...Array.from({ length: 7 }, () => 0.1), 0.3]
      : Array.from({ length: 7 }, () => 1 / 7);
    return shares.map((share) => ({
      shape: "single",
      main: total * share,
      toughness: { main: 20 * share },
    }));
  };
  // After each attack of Numby's in Windfall Bonanza!: A6's Energy and one
  // of its #4 attacks.
  const windfallAttack = (ctx: BattleApi, topaz: UnitView) => {
    if (!topaz.has(windfall)) return;
    if (k.a(3)) ctx.gainEnergy(topaz, k.traceParam(3, 1));
    ctx.addCounter(topaz, WINDFALL_ATTACKS, -1);
    if (topaz.counter(WINDFALL_ATTACKS) <= 1e-9) {
      ctx.removeStatus(topaz, windfall);
    }
  };

  const numbyDef = k.summon({
    id: "numby",
    speed: k.param("04", 1),
    // Numby attacks the Proof of Debt target.
    policy: (view) => {
      const target = debtTarget(view.enemies);
      return target ? { ability: "numbyFollowUp", target } : "numbyFollowUp";
    },
    abilities: [
      {
        id: "numbyFollowUp",
        kind: "followUp",
        hits: (ctx) =>
          ctx.self.owner ? numbyHits(ctx.self.owner, k.param("04", 2)) : [],
        after: (ctx) => {
          const topaz = ctx.self.owner;
          if (!topaz) return;
          windfallAttack(ctx, topaz);
          if (k.e(2)) ctx.gainEnergy(topaz, k.rankParam(2, 1));
        },
      },
    ],
  });

  // "Numby deals Fire DMG to this target ... considered as launching a
  // Follow-Up ATK."
  k.ability({
    id: "skill",
    kind: "skill",
    tags: ["skill", "followUp"],
    attack: true,
    before: (ctx) => {
      const target = ctx.target;
      if (!isEnemy(target)) return;
      for (const enemy of ctx.enemies) {
        if (enemy !== target) removeDebt(ctx, enemy);
      }
      ctx.applyStatus(target, proofOfDebt);
      const numby = ctx.findSummon(ctx.self, numbyDef.id);
      for (const hit of numbyHits(ctx.self, k.param("02", 1))) {
        ctx.deal(hit, {
          targets: [target],
          attacker: numby ?? undefined,
          tags: ["skill", "followUp"],
        });
      }
      if (numby) windfallAttack(ctx, ctx.self);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    before: (ctx) => {
      ctx.applyStatus(ctx.self, windfall);
      ctx.setCounter(
        ctx.self,
        WINDFALL_ATTACKS,
        k.param("03", 4) + (k.e(6) ? k.rankParam(6, 1) : 0)
      );
    },
  });

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.summon(ctx.self, numbyDef.id);
  });

  const isNumby = (ctx: BattleApi, unit: UnitView) =>
    unit.definitionId === numbyDef.id && unit.owner === ctx.self;
  k.on("turnStart", "talent", { subject: "ally" }, (ctx, event) => {
    if (!isNumby(ctx, event.unit)) return;
    ctx.setCounter(ctx.self, NUMBY_TURN, 1);
    if (k.e(4)) ctx.advanceAction(ctx.self, k.rankParam(4, 1));
  });
  k.on("turnEnd", "talent", { subject: "ally" }, (ctx, event) => {
    if (isNumby(ctx, event.unit)) ctx.setCounter(ctx.self, NUMBY_TURN, 0);
  });

  const advanceNumby = (ctx: BattleApi, fraction: number) => {
    // "Cannot be triggered during Numby's own turn."
    if (ctx.self.counter(NUMBY_TURN) > 0) return;
    const numby = ctx.findSummon(ctx.self, numbyDef.id);
    if (numby) ctx.advanceAction(numby, fraction);
  };

  k.on("actionStart", "talent", { subject: "ally" }, (ctx) => {
    ctx.setCounter(ctx.self, FOLLOW_UP_LATCH, 0);
    ctx.setCounter(ctx.self, WINDFALL_LATCH, 0);
  });

  // Once per attack that hits the Proof of Debt target. The Talent and the
  // Ultimate trigger separately, so a Follow-Up ATK that is also a Basic
  // ATK, Skill, or Ultimate advances Numby by both.
  k.on(
    "hit",
    "talent",
    { subject: "ally", tags: ["followUp"] },
    (ctx, event) => {
      if (!isEnemy(event.target) || !event.target.has(proofOfDebt)) return;
      if (ctx.self.counter(FOLLOW_UP_LATCH) > 0) return;
      ctx.setCounter(ctx.self, FOLLOW_UP_LATCH, 1);
      advanceNumby(ctx, k.param("04", 3));
    }
  );
  k.on(
    "hit",
    "ultimate",
    { subject: "ally", abilityKinds: ["basic", "skill", "ultimate"] },
    (ctx, event) => {
      if (!ctx.self.has(windfall)) return;
      if (!isEnemy(event.target) || !event.target.has(proofOfDebt)) return;
      if (ctx.self.counter(WINDFALL_LATCH) > 0) return;
      ctx.setCounter(ctx.self, WINDFALL_LATCH, 1);
      advanceNumby(ctx, k.param("03", 3));
    }
  );

  if (k.e(1)) {
    // The game adds a Debtor stack before a Follow-Up ATK lands on Proof of
    // Debt (OnBeforeBeingAttacked), once per attack, so that attack already
    // has it.
    k.on(
      "actionStart",
      "e1",
      { subject: "ally", tags: ["followUp"], attack: true },
      (ctx, event) => {
        const target = event.target;
        if (!isEnemy(target) || !target.has(proofOfDebt)) return;
        const next = debtorStacks.find((stack) => !target.has(stack));
        if (next) ctx.applyStatus(target, next);
      }
    );
  }
});
