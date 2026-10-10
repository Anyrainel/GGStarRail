import { type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Xueyi — Destruction, Quantum. */
export default defineCharacter("1214", (k) => {
  const maxKarma = k.e(6) ? k.rankParam(6, 1) : k.param("04", 1);
  const tallyCap = k.a(3) ? k.traceParam(3, 1) : 0;

  if (k.a(1)) {
    k.stat("a2", {
      stat: "dmgBoost",
      scaling: {
        source: "holder",
        stat: "breakEffect",
        ratio: k.traceParam(1, 1),
        cap: k.traceParam(1, 2),
      },
    });
  }

  if (k.e(1)) {
    k.stat("e1", {
      stat: "dmgBoost",
      value: k.rankParam(1, 1),
      filter: { tags: ["followUp"] },
    });
  }

  // "The more Toughness is reduced, the higher the DMG, up to #3": #3 = 4 × #2,
  // read as #2 per 10 Toughness of the Ultimate's 40 (verify item).
  const ultToughness = 40;
  const perTenToughness = k.param("03", 2);
  const toughnessBonus = k.status({
    id: "divine-castigation-toughness",
    origin: "ultimate",
    maxStacks: Math.round(k.param("03", 3) / perTenToughness),
    modifiers: [
      {
        stat: "dmgBoost",
        value: perTenToughness,
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  const a4Bonus = k.status({
    id: "a4-intrepid-rollerbearings",
    origin: "a4",
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.a(2) ? k.traceParam(2, 2) : 0,
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  const e4BreakEffect = k.status({
    id: "e4-break-effect",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "breakEffect", value: k.rankParam(4, 1) }],
  });

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
  });

  // Ignoring Weakness Types is not modeled: the engine only reduces Toughness
  // of matching Weaknesses (tracker xueyi-ignore-weakness).
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (k.e(4)) ctx.applyStatus(ctx.self, e4BreakEffect);
      const target = ctx.target;
      if (!isEnemy(target)) return;
      const reduced = target.broken
        ? 0
        : Math.min(target.toughness, ultToughness);
      if (reduced > 0) {
        ctx.applyStatus(ctx.self, toughnessBonus, { setStacks: reduced / 10 });
      }
      if (
        k.a(2) &&
        target.toughness >= k.traceParam(2, 1) * target.maxToughness - 1e-9
      ) {
        ctx.applyStatus(ctx.self, a4Bonus);
      }
    },
    hits: [
      {
        shape: "single",
        main: k.param("03", 1),
        toughness: { main: ultToughness },
      },
    ],
    after: (ctx) => {
      ctx.removeStatus(ctx.self, toughnessBonus);
      ctx.removeStatus(ctx.self, a4Bonus);
    },
  });

  /** Adds Karma; at the cap, tallies the excess (A6) and queues the Talent. */
  const gainKarma = (ctx: BattleApi, amount: number) => {
    const total = ctx.self.counter("karma") + amount;
    const excess = Math.max(0, total - maxKarma);
    ctx.setCounter(ctx.self, "karma", Math.min(maxKarma, total));
    if (excess > 0) {
      const tally = ctx.self.counter("karma-tally") + excess;
      ctx.setCounter(ctx.self, "karma-tally", Math.min(tallyCap, tally));
    }
    if (
      total >= maxKarma - 1e-9 &&
      ctx.self.counter("follow-up-queued") === 0
    ) {
      ctx.setCounter(ctx.self, "follow-up-queued", 1);
      ctx.queueAction(ctx.self, "followUp");
    }
  };

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 2,
    hits: [
      {
        shape: "bounce",
        each: k.param("04", 2),
        bounces: 3,
        toughness: { each: 5 },
      },
    ],
    before: (ctx) => {
      ctx.setCounter(ctx.self, "karma", 0);
      ctx.setCounter(ctx.self, "follow-up-queued", 0);
    },
    after: (ctx) => {
      const tally = ctx.self.counter("karma-tally");
      ctx.setCounter(ctx.self, "karma-tally", 0);
      if (tally > 0) gainKarma(ctx, tally);
    },
  });

  const toughnessLeft = (ctx: BattleApi) =>
    ctx.enemies.reduce((sum, enemy) => sum + enemy.toughness, 0);

  // Toughness reduced by an action is measured on the enemies: 1 Karma per
  // 10 Toughness for Xueyi's own attacks, 1 stack per teammate attack. Broken
  // enemies lose no Toughness and grant none (verify item).
  k.on("actionStart", "talent", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, "toughness-before", toughnessLeft(ctx))
  );
  k.on("actionEnd", "talent", { subject: "ally" }, (ctx, event) => {
    const reduced = ctx.self.counter("toughness-before") - toughnessLeft(ctx);
    if (reduced <= 1e-9 || !event.attack) return;
    if (event.unit === ctx.self) {
      if (event.abilityId === "followUp") return;
      gainKarma(ctx, reduced / 10);
    } else {
      gainKarma(ctx, k.param("04", 3) * ctx.weight);
    }
  });
});
