import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Topaz & Numby — The Hunt, Fire. */
export default defineCharacter("1112", (k) => {
  const NUMBY_TURN = "numby-turn";
  const WINDFALL_ATTACKS = "windfall-attacks";
  // Per-action latches for "receives a Follow-Up ATK" style triggers.
  const FOLLOW_UP_LATCH = "debt-follow-up";
  const WINDFALL_LATCH = "debt-windfall";
  const DEBTOR_LATCH = "debt-debtor";

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
  // the summon. The Skill's DMG (dealt by Numby in the text) is credited to
  // Topaz and does not receive them.
  const windfall = k.status({
    id: "windfall-bonanza",
    origin: "ultimate",
    modifiers: [
      {
        stat: "multiplierBoost",
        value: k.param("03", 1),
        filter: { attackerKinds: ["summon"] },
      },
      {
        stat: "critDmg",
        value: k.param("03", 2),
        filter: { attackerKinds: ["summon"] },
      },
    ],
  });
  const debtor = k.status({
    id: "debtor",
    origin: "e1",
    debuff: true,
    maxStacks: k.rankParam(1, 2),
  });
  // Approximation: Debtor's CRIT DMG is incoming, which the engine cannot
  // express; allies hold it for all Follow-Up ATKs while the Proof of Debt
  // target has Debtor stacks.
  const debtorCritDmg = k.status({
    id: "debtor-crit-dmg",
    origin: "e1",
    maxStacks: k.rankParam(1, 2),
    modifiers: [
      {
        stat: "critDmg",
        value: k.rankParam(1, 1),
        filter: { tags: ["followUp"] },
      },
    ],
  });

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

  const debtTarget = (ctx: BattleApi) =>
    ctx.enemies.find((enemy) => enemy.has(proofOfDebt));

  const syncDebtorCritDmg = (ctx: BattleApi) => {
    const stacks = debtTarget(ctx)?.stacks(debtor) ?? 0;
    for (const ally of ctx.allies) {
      if (stacks > 0) {
        ctx.applyStatus(ally, debtorCritDmg, { setStacks: stacks });
      } else {
        ctx.removeStatus(ally, debtorCritDmg);
      }
    }
  };

  // "A random enemy": the engine's main target, which the Skill also marks.
  const ensureDebt = (ctx: BattleApi) => {
    if (debtTarget(ctx)) return;
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

  k.ability({
    id: "skill",
    kind: "skill",
    tags: ["skill", "followUp"],
    before: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      for (const enemy of ctx.enemies) {
        if (enemy === ctx.target) continue;
        ctx.removeStatus(enemy, proofOfDebt);
        ctx.removeStatus(enemy, debtor);
      }
      ctx.applyStatus(ctx.target, proofOfDebt);
      if (k.e(1)) syncDebtorCritDmg(ctx);
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
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

  // Numby attacks the Proof of Debt target, which is always the engine's
  // main target (see ensureDebt and the Skill).
  const numbyDef = k.summon({
    id: "numby",
    speed: k.param("04", 1),
    policy: () => "numbyFollowUp",
    abilities: [
      {
        id: "numbyFollowUp",
        kind: "followUp",
        hits: [
          {
            shape: "single",
            main: k.param("04", 2),
            toughness: { main: 20 },
          },
        ],
        after: (ctx) => {
          const topaz = ctx.self.owner;
          if (!topaz) return;
          if (topaz.has(windfall)) {
            if (k.a(3)) ctx.gainEnergy(topaz, k.traceParam(3, 1));
            ctx.addCounter(topaz, WINDFALL_ATTACKS, -1);
            if (topaz.counter(WINDFALL_ATTACKS) <= 1e-9) {
              ctx.removeStatus(topaz, windfall);
            }
          }
          if (k.e(2)) ctx.gainEnergy(topaz, k.rankParam(2, 1));
        },
      },
    ],
  });

  // The API cannot look up summons, so the battle-start summon keeps a
  // handle for the Action Advance effects.
  let numby: UnitView | null = null;
  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    numby = ctx.summon(ctx.self, numbyDef.id);
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
    if (!numby || ctx.self.counter(NUMBY_TURN) > 0) return;
    ctx.advanceAction(numby, fraction);
  };

  k.on("actionStart", "talent", { subject: "ally" }, (ctx) => {
    ctx.setCounter(ctx.self, FOLLOW_UP_LATCH, 0);
    ctx.setCounter(ctx.self, WINDFALL_LATCH, 0);
    ctx.setCounter(ctx.self, DEBTOR_LATCH, 0);
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
    k.on("hit", "e1", { subject: "ally", tags: ["followUp"] }, (ctx, event) => {
      if (!isEnemy(event.target) || !event.target.has(proofOfDebt)) return;
      if (ctx.self.counter(DEBTOR_LATCH) > 0) return;
      ctx.setCounter(ctx.self, DEBTOR_LATCH, 1);
      ctx.applyStatus(event.target, debtor);
      syncDebtorCritDmg(ctx);
    });
  }
});
