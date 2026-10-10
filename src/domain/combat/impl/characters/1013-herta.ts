import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

const TALENT_CYCLE = "talent-cycle";
const TALENT_PROCS = "talent-procs-used";

/** Herta — Erudition, Ice. */
export default defineCharacter("1013", (k) => {
  // The Talent fires when an ally attack takes an enemy to 50% HP or lower.
  // Enemy HP is not simulated, so procs per cycle are a user count; each
  // proc follows the first ally attacks of the cycle.
  const talentProcs = k.count("talent-procs", "talent", "perCycle", 1, 5);

  // "If the enemy's HP percentage is 50% or higher": one assumption for all
  // targets. A2 raises that same conditional boost.
  const highHp = k.toggle(
    "skill-high-hp",
    "skill",
    "enemyHpAbove",
    true,
    k.param("02", 2)
  );
  if (highHp) {
    k.stat("skill", {
      stat: "dmgBoost",
      value: k.param("02", 3),
      filter: { tags: ["skill"] },
    });
    if (k.a(1)) {
      k.stat("a2", {
        stat: "dmgBoost",
        value: k.traceParam(1, 1),
        filter: { tags: ["skill"] },
      });
    }
  }

  if (k.a(3)) {
    k.stat("a6", {
      stat: "dmgBoost",
      value: k.traceParam(3, 1),
      filter: { tags: ["ultimate"], targetFamilies: ["frozen"] },
    });
  }

  if (k.e(4)) {
    k.stat("e4", {
      stat: "dmgBoost",
      value: k.rankParam(4, 1),
      filter: { tags: ["followUp"] },
    });
  }

  const keepTheBallRolling = k.status({
    id: "keep-the-ball-rolling",
    origin: "e2",
    maxStacks: k.rankParam(2, 2),
    modifiers: [{ stat: "critRate", value: k.rankParam(2, 1) }],
  });
  const noOneCanBetrayMe = k.status({
    id: "no-one-can-betray-me",
    origin: "e6",
    duration: { turns: k.rankParam(6, 2) },
    modifiers: [{ stat: "atkPct", value: k.rankParam(6, 1) }],
  });

  const lowHpBasic =
    k.e(1) &&
    k.toggle("e1-low-hp", "e1", "enemyHpBelow", true, k.rankParam(1, 1));

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (!lowHpBasic || !isEnemy(ctx.target)) return;
      ctx.deal(
        {
          shape: "single",
          main: k.rankParam(1, 2),
          onlyTags: ["additional"],
        },
        { targets: [ctx.target], origin: "e1" }
      );
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [{ shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } }],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      if (k.e(6)) ctx.applyStatus(ctx.self, noOneCanBetrayMe);
    },
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 5,
    hits: [{ shape: "aoe", each: k.param("04", 2), toughness: { each: 5 } }],
    after: (ctx) => {
      if (k.e(2)) ctx.applyStatus(ctx.self, keepTheBallRolling);
    },
  });

  k.on(
    "actionEnd",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      if (event.unit === ctx.self && event.abilityKind === "followUp") return;
      const cycle = ctx.cycle + 1;
      if (ctx.self.counter(TALENT_CYCLE) !== cycle) {
        ctx.setCounter(ctx.self, TALENT_CYCLE, cycle);
        ctx.setCounter(ctx.self, TALENT_PROCS, 0);
      }
      const used = ctx.self.counter(TALENT_PROCS);
      if (used >= talentProcs) return;
      ctx.setCounter(ctx.self, TALENT_PROCS, used + 1);
      ctx.queueAction(ctx.self, "followUp");
    }
  );
});
