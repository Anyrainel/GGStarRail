import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Dr. Ratio — The Hunt, Imaginary. */
export default defineCharacter("1305", (k) => {
  // Summation has no duration: stacks accumulate across Skills (E1 grants
  // some at battle start and raises the cap).
  const summation = k.status({
    id: "summation",
    origin: "a2",
    maxStacks: k.traceParam(1, 3) + (k.e(1) ? k.rankParam(1, 1) : 0),
    modifiers: [
      { stat: "critRate", value: k.traceParam(1, 1) },
      { stat: "critDmg", value: k.traceParam(1, 2) },
    ],
  });

  // Enemy Effect RES is a scenario constant in the engine; the debuff still
  // counts toward Dr. Ratio's per-debuff effects.
  const inference = k.status({
    id: "inference",
    origin: "a4",
    debuff: true,
    duration: { turns: k.traceParam(2, 3) },
    modifiers: [{ stat: "effectRes", value: -k.traceParam(2, 2) }],
  });

  const deductionPerDebuff = k.traceParam(3, 2);
  const deduction = k.status({
    id: "deduction",
    origin: "a6",
    maxStacks: Math.round(k.traceParam(3, 3) / deductionPerDebuff),
    modifiers: [{ stat: "dmgBoost", value: deductionPerDebuff }],
  });
  // A6 depends on the target's debuffs. Every Dr. Ratio hit is single-target,
  // so the stacks are synced to the target before each damaging action.
  const syncDeduction = (ctx: BattleApi, target: UnitView | null) => {
    if (!k.a(3)) return;
    const debuffs = isEnemy(target) ? target.debuffCount() : 0;
    if (debuffs >= k.traceParam(3, 1)) {
      ctx.applyStatus(ctx.self, deduction, { setStacks: debuffs });
    } else {
      ctx.removeStatus(ctx.self, deduction);
    }
  };

  // Treated as a debuff (it counts toward his per-debuff effects) that is
  // removed once its triggers are used up; tracked as verify.
  const wisemansFolly = k.status({
    id: "wisemans-folly",
    origin: "ultimate",
    debuff: true,
  });
  const follyCharges = k.param("03", 2) + (k.e(6) ? k.rankParam(6, 1) : 0);

  if (k.e(1) && k.a(1)) {
    k.on("battleStart", "e1", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, summation, { stacks: k.rankParam(1, 2) })
    );
  }

  if (k.e(6)) {
    k.stat("e6", {
      stat: "dmgBoost",
      value: k.rankParam(6, 2),
      filter: { tags: ["followUp"] },
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    before: (ctx) => syncDeduction(ctx, ctx.target),
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      if (k.a(1) && isEnemy(ctx.target)) {
        const debuffs = ctx.target.debuffCount();
        if (debuffs > 0) {
          ctx.applyStatus(ctx.self, summation, { stacks: debuffs });
        }
      }
      syncDeduction(ctx, ctx.target);
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      const target = ctx.target;
      if (!isEnemy(target)) return;
      if (k.a(2)) {
        ctx.applyStatus(target, inference, {
          baseChance: k.traceParam(2, 1),
        });
      }
      // The Talent's fixed chance counts the debuffs present after the Skill
      // attack, A4's included (tracked as verify).
      const chance = Math.min(
        1,
        k.param("04", 2) + k.param("04", 3) * target.debuffCount()
      );
      ctx.queueAction(ctx.self, "followUp", { target, weight: chance });
    },
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 5,
    before: (ctx) => syncDeduction(ctx, ctx.target),
    hits: [
      { shape: "single", main: k.param("04", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (k.e(4)) ctx.gainEnergy(ctx.self, k.rankParam(4, 1));
      const target = ctx.target;
      if (!k.e(2) || !isEnemy(target)) return;
      const procs = Math.min(target.debuffCount(), k.rankParam(2, 2));
      for (let index = 0; index < procs; index += 1) {
        ctx.deal(
          {
            shape: "single",
            main: k.rankParam(2, 1),
            onlyTags: ["additional"],
          },
          { targets: [target], origin: "e2" }
        );
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => syncDeduction(ctx, ctx.target),
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      for (const enemy of ctx.enemies) ctx.removeStatus(enemy, wisemansFolly);
      ctx.applyStatus(ctx.target, wisemansFolly);
      ctx.setCounter(ctx.self, "wisemans-folly", follyCharges);
    },
  });

  // The action's target stands for the attacked enemy: allies' Blast and AoE
  // attacks are centered on the same main target as his Ultimate.
  k.on(
    "actionEnd",
    "ultimate",
    { subject: "otherAlly", attack: true },
    (ctx, event) => {
      const target = event.target;
      if (!isEnemy(target) || !target.has(wisemansFolly, ctx.self)) return;
      const charges = ctx.self.counter("wisemans-folly");
      if (charges <= 1e-9) return;
      const portion = Math.min(1, charges);
      ctx.addCounter(ctx.self, "wisemans-folly", -portion);
      ctx.queueAction(ctx.self, "followUp", { target, weight: portion });
      if (ctx.self.counter("wisemans-folly") <= 1e-9) {
        ctx.removeStatus(target, wisemansFolly);
      }
    }
  );
});
