import { type ActionContext, type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const CHARGE = "charge";
/** A6 bonuses fixed at battle start, as ratios per Charge or heal. */
const A6_CHARGE = "a6-charge-ratio";
const A6_HEAL = "a6-heal-boost";
/** The engine's HP floor (1%), standing in for a killing blow. */
const HP_FLOOR = 0.01;

/** Mydei — Destruction, Imaginary. */
export default defineCharacter("1404", (k) => {
  // Printed without placeholders: "up to 200 points", "When Charge reaches 100".
  const maxCharge = 200;
  const vendettaCharge = 100;
  const godslayerAt = k.e(6) ? k.rankParam(6, 1) : k.param("04", 3);
  const godslayerCost = k.e(6) ? k.rankParam(6, 1) : k.param("11", 3);

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

  // Ultimate: Taunts the target and adjacent targets.
  const taunt = k.status({
    id: "throne-of-bones-taunt",
    origin: "ultimate",
    debuff: true,
    taunt: true,
    duration: { turns: k.param("03", 4) },
  });

  const a6Step = 100; // "for every 100 excess HP" (no placeholder)
  if (k.a(3)) {
    // "When battle starts": evaluated on Max HP without Vendetta's bonus,
    // which is a scaling modifier and never feeds another conversion.
    k.stat("a6", {
      stat: "critRate",
      scaling: {
        source: "holder",
        stat: "hp",
        threshold: k.traceParam(3, 1),
        step: a6Step,
        ratio: k.traceParam(3, 3),
        cap: (k.traceParam(3, 2) / a6Step) * k.traceParam(3, 3),
      },
    });
  }

  const inVendetta = (ctx: BattleApi) => ctx.self.has(vendetta);

  const addCharge = (ctx: BattleApi, amount: number) => {
    if (ctx.self.counter("godslayer-active") > 0 || amount <= 0) return;
    ctx.addCounter(ctx.self, CHARGE, amount, maxCharge);
  };

  /** E2: healing received during Vendetta, as a share of Max HP. */
  const convertHeal = (ctx: BattleApi, share: number) => {
    if (!k.e(2) || !inVendetta(ctx) || share <= 0) return;
    const converted = Math.min(
      k.rankParam(2, 3) - ctx.self.counter("e2-tally"),
      share * 100 * k.rankParam(2, 2)
    );
    if (converted <= 0) return;
    ctx.addCounter(ctx.self, "e2-tally", converted);
    addCharge(ctx, converted);
  };

  /**
   * Mydei's own healing. The E2 listener converts what is restored; the
   * part beyond Max HP (not reported) is converted here.
   */
  const healSelf = (ctx: BattleApi, share: number) => {
    const amount = share * (1 + ctx.self.currentStat("outgoingHealing"));
    const restored =
      ctx.weight > 0 ? ctx.heal(ctx.self, amount) / ctx.weight : 0;
    convertHeal(ctx, amount - restored);
  };

  /**
   * Charge thresholds; call only where the trigger weight is 1. At his own
   * turn start the Godslayer check waits for Kingslayer, so the extra turn
   * follows the current one.
   */
  const checkCharge = (ctx: BattleApi, allowGodslayer = true) => {
    if (!inVendetta(ctx) && ctx.self.counter(CHARGE) >= vendettaCharge) {
      ctx.setCounter(
        ctx.self,
        CHARGE,
        ctx.self.counter(CHARGE) - vendettaCharge
      );
      ctx.applyStatus(ctx.self, vendetta);
      healSelf(ctx, k.param("04", 1));
      ctx.advanceAction(ctx.self, 1);
    }
    if (
      allowGodslayer &&
      inVendetta(ctx) &&
      ctx.self.counter(CHARGE) >= godslayerAt - 1e-9 &&
      ctx.self.counter("godslayer-pending") === 0
    ) {
      ctx.setCounter(ctx.self, "godslayer-pending", 1);
      ctx.grantExtraTurn(ctx.self);
    }
  };

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    if (k.a(3)) {
      const excess = Math.min(
        k.traceParam(3, 2),
        Math.max(0, ctx.self.panelStat("hp") - k.traceParam(3, 1))
      );
      const steps = Math.floor(excess / a6Step + 1e-9);
      ctx.setCounter(ctx.self, A6_CHARGE, steps * k.traceParam(3, 4));
      ctx.setCounter(ctx.self, A6_HEAL, steps * k.traceParam(3, 5));
    }
    // E6: enters Vendetta on entering battle (no heal or advance stated).
    if (k.e(6)) ctx.applyStatus(ctx.self, vendetta);
  });

  // 1 Charge per 1% of HP lost, from any cause; A6 raises the ratio for
  // enemy DMG. The event weight makes it an expected value.
  k.on(
    "hpChanged",
    "talent",
    { when: (event) => (event.delta ?? 0) < 0 },
    (ctx, event) => {
      const ratio =
        event.hpCause === "enemy" ? 1 + ctx.self.counter(A6_CHARGE) : 1;
      addCharge(ctx, -(event.delta ?? 0) * 100 * ratio);
    }
  );

  // Killing blows are not simulated (allies stay at 1% HP or more): an enemy
  // hit that leaves him at the floor during Vendetta stands in for one. It
  // clears Charge and restores HP; A2 keeps Vendetta up to #1 times.
  k.on(
    "hpChanged",
    "talent",
    {
      when: (event, self) =>
        event.hpCause === "enemy" && self.hpRatio <= HP_FLOOR + 1e-9,
    },
    (ctx) => {
      if (!inVendetta(ctx) || ctx.weight <= 0) return;
      ctx.setCounter(ctx.self, CHARGE, 0);
      const saves = ctx.self.counter("a2-saves");
      if (k.a(1) && saves < k.traceParam(1, 1)) {
        ctx.setCounter(ctx.self, "a2-saves", saves + 1);
      } else {
        ctx.removeStatus(ctx.self, vendetta);
      }
      // The floor was reached for certain: restore at full weight.
      healSelf(ctx, k.param("04", 4) / ctx.weight);
    }
  );

  if (k.e(4)) {
    // After being attacked during Vendetta (with Mydei's share of the attack).
    k.on(
      "hpChanged",
      "e4",
      { when: (event) => event.hpCause === "enemy" },
      (ctx) => {
        if (inVendetta(ctx)) healSelf(ctx, k.rankParam(4, 1));
      }
    );
  }

  // A6 heal boost and E2 conversion of every heal Mydei receives.
  let boosting = false;
  k.on(
    "hpChanged",
    "a6",
    {
      when: (event, self) =>
        !boosting &&
        event.hpCause === "heal" &&
        (event.delta ?? 0) > 0 &&
        self.counter(A6_HEAL) > 0,
    },
    (ctx, event) => {
      boosting = true;
      ctx.heal(ctx.self, (event.delta ?? 0) * ctx.self.counter(A6_HEAL));
      boosting = false;
    }
  );
  if (k.e(2)) {
    k.on(
      "hpChanged",
      "e2",
      { when: (event) => event.hpCause === "heal" },
      (ctx, event) => convertHeal(ctx, event.delta ?? 0)
    );
  }

  k.on("turnStart", "talent", {}, (ctx) => checkCharge(ctx, false));
  // Thresholds crossed during other units' actions resolve at their end
  // (weight 1).
  k.on("turnEnd", "talent", { subject: "enemy" }, (ctx) => {
    ctx.setCounter(ctx.self, "e2-tally", 0);
    checkCharge(ctx);
  });
  k.on(
    "actionEnd",
    "talent",
    { subject: "otherAlly", when: (event) => event.weight >= 1 - 1e-9 },
    (ctx) => checkCharge(ctx)
  );
  k.on("actionEnd", "e2", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, "e2-tally", 0)
  );

  const consumeCurrent = (ctx: ActionContext, ratio: number) => {
    ctx.consumeHp(ctx.self, ctx.self.hpRatio * ratio);
    checkCharge(ctx);
  };

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
    before: (ctx) => consumeCurrent(ctx, k.param("02", 3)),
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
    before: (ctx) => consumeCurrent(ctx, k.param("09", 3)),
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
        CHARGE,
        Math.max(0, ctx.self.counter(CHARGE) - godslayerCost)
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
      healSelf(ctx, k.param("03", 3));
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
    after: (ctx) => {
      const target = ctx.target;
      if (!isEnemy(target)) return;
      const index = ctx.enemies.indexOf(target);
      for (const enemy of [
        ctx.enemies[index - 1],
        target,
        ctx.enemies[index + 1],
      ]) {
        if (enemy) ctx.applyStatus(enemy, taunt);
      }
    },
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
