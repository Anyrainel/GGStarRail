import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Sampo — Nihility, Wind. */
export default defineCharacter("1108", (k) => {
  const windShear = k.status({
    id: "wind-shear",
    origin: "talent",
    debuff: true,
    duration: {
      turns: k.param("04", 3) + (k.a(1) ? k.traceParam(1, 1) : 0),
    },
    maxStacks: k.param("04", 4),
    dot: {
      hit: {
        shape: "single",
        main: k.param("04", 2) + (k.e(6) ? k.rankParam(6, 1) : 0),
        kind: "dot",
      },
    },
  });

  const dotTaken = k.status({
    id: "surprise-present",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 3) },
    modifiers: [
      {
        stat: "vulnerability",
        value: k.param("03", 2),
        filter: { tags: ["dot"] },
      },
    ],
  });

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // Bounce facts list Energy per hit (6), so the Skill's Energy is ×hits.
  const bounces = k.param("02", 1) + (k.e(1) ? k.rankParam(1, 1) : 0);
  k.ability({
    id: "skill",
    kind: "skill",
    energy: 6 * (1 + bounces),
    hits: [
      { shape: "single", main: k.param("02", 2), toughness: { main: 10 } },
      {
        shape: "bounce",
        each: k.param("02", 2),
        bounces,
        toughness: { each: 10 },
      },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    energy: 5 + (k.a(2) ? k.traceParam(2, 1) : 0),
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, dotTaken, { baseChance: k.param("03", 4) });
      }
    },
  });

  k.on(
    "hit",
    "talent",
    { subject: "self", abilityKinds: ["basic", "skill", "ultimate"] },
    (ctx, event) => {
      const target = event.target;
      if (!isEnemy(target)) return;
      if (
        k.e(4) &&
        event.abilityKind === "skill" &&
        target.stacks(windShear) >= k.rankParam(4, 1) - 1e-9
      ) {
        // Sampo's own Wind Shear; Break Wind Shear is a separate engine status.
        ctx.detonateDots(target, k.rankParam(4, 2), {
          filter: (status) => status === windShear,
        });
      }
      // A Bounce placement carries the expected number of hits on this
      // enemy; applyStatus ignores weight, so the stacks carry it.
      ctx.applyStatus(target, windShear, {
        stacks: event.weight,
        baseChance: k.param("04", 1),
      });
    }
  );

  if (k.e(2)) {
    // Kills are not simulated: the user sets how many Wind Shear-afflicted
    // enemies are defeated per cycle (default 0, the boss scenario). EN says
    // "equivalent to that of Skill"; ZH says the Talent's Wind Shear.
    const defeats = k.count("e2-defeats", "e2", "perCycle", 0, 5);
    if (defeats > 0) {
      k.on("turnStart", "e2", { subject: "self" }, (ctx) => {
        if (ctx.self.counter("e2-cycle") > ctx.cycle) return;
        ctx.setCounter(ctx.self, "e2-cycle", ctx.cycle + 1);
        for (const enemy of ctx.enemies) {
          ctx.applyStatus(enemy, windShear, {
            stacks: defeats * k.rankParam(2, 2),
            baseChance: k.rankParam(2, 1),
          });
        }
      });
    }
  }
});
