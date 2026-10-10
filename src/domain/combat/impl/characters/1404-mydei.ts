import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Mydei — Destruction, Imaginary. */
export default defineCharacter("1404", (k) => {
  // Printed without placeholders: "up to 200 points", "When Charge reaches 100".
  const maxCharge = 200;
  const vendettaCharge = 100;
  const godslayerAt = k.e(6) ? k.rankParam(6, 1) : k.param("04", 3);
  const godslayerCost = k.e(6) ? k.rankParam(6, 1) : k.param("11", 3);

  // HP is not simulated, so the kit tracks Mydei's HP as a fraction of Max HP
  // ("hp" counter, kept when Vendetta raises Max HP) to derive Charge.
  // Assumptions (tracker mydei-hp-model): each enemy attack on Mydei costs 10%
  // Max HP, and with a sustain ally his HP is topped up to 80% at the start
  // of his turns.
  const enemyHitHp = 0.1;
  const sustainFloor = 0.8;
  const sustained = k.toggle(
    "sustained",
    "talent",
    "selfHpAbove",
    true,
    sustainFloor
  );

  const vendettaModifiers: ModifierDef[] = [
    {
      stat: "hpFlat",
      scaling: { source: "holder", stat: "hp", ratio: k.param("04", 5) },
    },
  ];
  if (k.e(2))
    vendettaModifiers.push({ stat: "defIgnore", value: k.rankParam(2, 1) });
  if (k.e(4))
    vendettaModifiers.push({ stat: "critDmg", value: k.rankParam(4, 2) });
  const vendetta = k.status({
    id: "vendetta",
    origin: "talent",
    modifiers: vendettaModifiers,
  });

  if (k.a(3)) {
    // "When battle starts": evaluated on Max HP without Vendetta's bonus,
    // which is a scaling modifier and never feeds another conversion.
    const step = 100;
    k.stat("a6", {
      stat: "critRate",
      scaling: {
        source: "holder",
        stat: "hp",
        threshold: k.traceParam(3, 1),
        step,
        ratio: k.traceParam(3, 3),
        cap: (k.traceParam(3, 2) / step) * k.traceParam(3, 3),
      },
    });
  }

  const inVendetta = (ctx: BattleApi) => ctx.self.has(vendetta);
  const hp = (ctx: BattleApi) => ctx.self.counter("hp");

  const addCharge = (ctx: BattleApi, amount: number) => {
    if (ctx.self.counter("godslayer-active") > 0) return;
    const next = Math.min(maxCharge, ctx.self.counter("charge") + amount);
    ctx.setCounter(ctx.self, "charge", next);
  };

  /** Healing received; E2 converts part of it to Charge during Vendetta. */
  const heal = (ctx: BattleApi, amount: number) => {
    ctx.setCounter(ctx.self, "hp", Math.min(1, hp(ctx) + amount));
    // ZH scopes the conversion to Vendetta (【血仇】状态期间，…且接受治疗后…);
    // EN puts it in a separate sentence.
    if (!k.e(2) || !inVendetta(ctx)) return;
    const tally = ctx.self.counter("e2-tally");
    const converted = Math.min(
      k.rankParam(2, 3) - tally,
      amount * 100 * k.rankParam(2, 2)
    );
    if (converted <= 0) return;
    ctx.setCounter(ctx.self, "e2-tally", tally + converted);
    addCharge(ctx, converted);
  };

  /** HP lost as a fraction of Max HP: 1 Charge per 1%. */
  const loseHp = (ctx: BattleApi, amount: number, chargeRatio = 1) => {
    addCharge(ctx, amount * 100 * chargeRatio);
    const left = hp(ctx) - amount;
    if (left > 0) {
      ctx.setCounter(ctx.self, "hp", left);
      return;
    }
    if (!inVendetta(ctx)) {
      // Being knocked down is not simulated.
      ctx.setCounter(ctx.self, "hp", 0.01);
      return;
    }
    // Killing blow during Vendetta: Charge is cleared and HP restored; A2
    // keeps Vendetta up to #1 times per battle.
    ctx.setCounter(ctx.self, "charge", 0);
    ctx.setCounter(ctx.self, "hp", 0);
    const saves = ctx.self.counter("a2-saves");
    if (k.a(1) && saves < k.traceParam(1, 1)) {
      ctx.setCounter(ctx.self, "a2-saves", saves + 1);
    } else {
      ctx.removeStatus(ctx.self, vendetta);
    }
    heal(ctx, k.param("04", 4));
  };

  /**
   * Charge thresholds; call only where the trigger weight is 1. At his own
   * turn start the Godslayer check waits for Kingslayer, so the extra turn
   * follows the current one.
   */
  const checkCharge = (ctx: BattleApi, allowGodslayer = true) => {
    if (!inVendetta(ctx) && ctx.self.counter("charge") >= vendettaCharge) {
      ctx.setCounter(
        ctx.self,
        "charge",
        ctx.self.counter("charge") - vendettaCharge
      );
      ctx.applyStatus(ctx.self, vendetta);
      heal(ctx, k.param("04", 1));
      ctx.advanceAction(ctx.self, 1);
    }
    if (
      allowGodslayer &&
      inVendetta(ctx) &&
      ctx.self.counter("charge") >= godslayerAt - 1e-9 &&
      ctx.self.counter("godslayer-pending") === 0
    ) {
      ctx.setCounter(ctx.self, "godslayer-pending", 1);
      ctx.grantExtraTurn(ctx.self);
    }
  };

  // A6 Charge ratio from enemy DMG at its cap (Max HP 8000): timelines may
  // only depend on SPD and Energy Regeneration (optimizer timeline cache).
  const enemyChargeRatio =
    1 + (k.a(3) ? (k.traceParam(3, 2) / 100) * k.traceParam(3, 4) : 0);

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.setCounter(ctx.self, "hp", 1);
    // E6: enters Vendetta on entering battle (no heal or advance stated).
    if (k.e(6)) ctx.applyStatus(ctx.self, vendetta);
  });

  k.on("turnStart", "talent", {}, (ctx) => {
    if (sustained && hp(ctx) < sustainFloor) {
      heal(ctx, sustainFloor - hp(ctx));
    }
    checkCharge(ctx, false);
  });

  k.on("hitByEnemy", "talent", {}, (ctx) => {
    // ctx.weight is this unit's share of the enemy attack.
    loseHp(ctx, enemyHitHp * ctx.weight, enemyChargeRatio);
    if (k.e(4) && inVendetta(ctx)) heal(ctx, k.rankParam(4, 1) * ctx.weight);
  });
  // Thresholds crossed during an enemy turn resolve at its end (weight 1).
  k.on("turnEnd", "talent", { subject: "enemy" }, (ctx) => {
    ctx.setCounter(ctx.self, "e2-tally", 0);
    checkCharge(ctx);
  });
  k.on("actionEnd", "e2", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, "e2-tally", 0)
  );

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        stat: "hp",
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    skillPoints: 0,
    before: (ctx) => {
      loseHp(ctx, hp(ctx) * k.param("02", 3));
      checkCharge(ctx);
    },
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        stat: "hp",
        toughness: { main: 20, adjacent: 10 },
      },
    ],
  });

  k.ability({
    id: "kingslayer",
    kind: "skill",
    skillPoints: 0,
    before: (ctx) => {
      loseHp(ctx, hp(ctx) * k.param("09", 3));
      checkCharge(ctx);
    },
    hits: [
      {
        shape: "blast",
        main: k.param("09", 1),
        adjacent: k.param("09", 2),
        stat: "hp",
        toughness: { main: 20, adjacent: 10 },
      },
    ],
  });

  k.ability({
    id: "godslayer",
    kind: "skill",
    skillPoints: 0,
    energy: 10,
    before: (ctx) => {
      ctx.setCounter(ctx.self, "godslayer-pending", 0);
      ctx.setCounter(
        ctx.self,
        "charge",
        Math.max(0, ctx.self.counter("charge") - godslayerCost)
      );
      ctx.setCounter(ctx.self, "godslayer-active", 1);
    },
    hits: [
      k.e(1)
        ? {
            shape: "aoe",
            each: k.param("11", 1) + k.rankParam(1, 1),
            stat: "hp",
            toughness: { main: 30, each: 20 },
          }
        : {
            shape: "blast",
            main: k.param("11", 1),
            adjacent: k.param("11", 2),
            stat: "hp",
            toughness: { main: 30, adjacent: 20 },
          },
    ],
    after: (ctx) => {
      ctx.setCounter(ctx.self, "godslayer-active", 0);
      checkCharge(ctx);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      heal(ctx, k.param("03", 3));
      addCharge(ctx, k.param("03", 5));
      checkCharge(ctx);
    },
    hits: [
      {
        shape: "blast",
        main: k.param("03", 1),
        adjacent: k.param("03", 2),
        stat: "hp",
        toughness: { main: 20, adjacent: 20 },
      },
    ],
  });

  // Skill costs no Skill Points (facts); Vendetta turns auto-cast Kingslayer,
  // and the extra turn at full Charge auto-casts Godslayer.
  k.policy({
    turn: (view) =>
      view.self.counter("godslayer-pending") > 0
        ? "godslayer"
        : view.self.has(vendetta)
          ? "kingslayer"
          : "skill",
  });
});
