import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Seele — The Hunt, Quantum. */
export default defineCharacter("1102", (k) => {
  const speedBoost = k.status({
    id: "sheathed-blade-spd",
    origin: "skill",
    duration: { turns: k.param("02", 3) },
    maxStacks: k.e(2) ? k.rankParam(2, 1) : 1,
    modifiers: [{ stat: "spdPct", value: k.param("02", 2) }],
  });

  const amplification = k.status({
    id: "amplification",
    origin: "talent",
    duration: { turns: k.param("04", 2) },
    modifiers: [
      { stat: "dmgBoost", value: k.param("04", 1) },
      ...(k.a(2)
        ? [
            {
              stat: "resPen" as const,
              value: k.traceParam(2, 1),
              filter: { combatTypes: ["Quantum" as const] },
            },
          ]
        : []),
    ],
  });

  // Resurgence needs a kill; without enemy HP it is a user assumption.
  const resurgence = k.toggle("resurgence", "talent", "active", false);

  if (k.e(1)) {
    const lowHp = k.toggle(
      "e1-low-hp",
      "e1",
      "enemyHpBelow",
      true,
      k.rankParam(1, 1)
    );
    if (lowHp) k.stat("e1", { stat: "critRate", value: k.rankParam(1, 2) });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (k.a(3)) ctx.advanceAction(ctx.self, k.traceParam(3, 1));
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => ctx.applyStatus(ctx.self, speedBoost),
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
  });

  const flurry = k.status({
    id: "butterfly-flurry",
    origin: "e6",
    debuff: true,
    duration: { turns: k.rankParam(6, 2) },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => ctx.applyStatus(ctx.self, amplification),
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => {
      if (k.e(6) && ctx.target) ctx.applyStatus(ctx.target, flurry);
      if (resurgence) ctx.grantExtraTurn(ctx.self);
    },
  });

  if (k.e(6)) {
    // Approximation: 15% of the Ultimate's multiplier as Additional DMG,
    // evaluated with the current buffs instead of the Ultimate's own.
    k.on("actionEnd", "e6", { subject: "ally", attack: true }, (ctx, event) => {
      const target = event.target;
      if (!isEnemy(target) || !target.has(flurry)) return;
      ctx.deal(
        {
          shape: "single",
          main: k.rankParam(6, 1) * k.param("03", 1),
          onlyTags: ["additional"],
        },
        { targets: [target], origin: "e6" }
      );
    });
  }
});
