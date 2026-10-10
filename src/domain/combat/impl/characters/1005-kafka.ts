import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Kafka — Nihility, Lightning. */
export default defineCharacter("1005", (k) => {
  const shockChance = k.param("03", 2) + (k.a(3) ? k.traceParam(3, 1) : 0);
  const shock = k.status({
    id: "shock",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 3) + (k.e(6) ? k.rankParam(6, 2) : 0) },
    dot: {
      hit: {
        shape: "single",
        main: k.param("03", 4) + (k.e(6) ? k.rankParam(6, 1) : 0),
        kind: "dot",
      },
    },
  });

  const e1Vulnerability = k.status({
    id: "e1-dot-taken",
    origin: "e1",
    debuff: true,
    duration: { turns: k.rankParam(1, 3) },
    modifiers: [
      {
        stat: "vulnerability",
        value: k.rankParam(1, 2),
        filter: { tags: ["dot"] },
      },
    ],
  });

  if (k.e(2)) {
    k.teamStat("e2", {
      stat: "dmgBoost",
      value: k.rankParam(2, 1),
      filter: { tags: ["dot"] },
    });
  }

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
        adjacent: k.param("02", 3),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) ctx.detonateDots(ctx.target, k.param("02", 2));
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, shock, { baseChance: shockChance });
        ctx.detonateDots(
          enemy,
          k.param("03", 5),
          k.a(1) ? {} : { filter: (status) => status === shock }
        );
      }
    },
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 10,
    hits: [
      { shape: "single", main: k.param("04", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      ctx.applyStatus(ctx.target, shock, { baseChance: shockChance });
      if (k.e(1)) {
        ctx.applyStatus(ctx.target, e1Vulnerability, {
          baseChance: k.rankParam(1, 1),
        });
      }
    },
  });

  k.on(
    "actionEnd",
    "talent",
    {
      subject: "otherAlly",
      abilityKinds: ["basic"],
      attack: true,
      limitPerTurn: 1,
    },
    (ctx, event) => {
      ctx.queueAction(ctx.self, "followUp", {
        target: isEnemy(event.target) ? event.target : undefined,
      });
    }
  );

  if (k.e(4)) {
    k.on("dotTick", "e4", { subject: "enemy", status: shock }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(4, 1))
    );
  }
});
