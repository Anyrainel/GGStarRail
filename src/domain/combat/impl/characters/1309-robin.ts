import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Robin — Harmony, Physical. */
export default defineCharacter("1309", (k) => {
  const aria = k.status({
    id: "pinions-aria",
    origin: "skill",
    // "This duration decreases by 1 at the start of Robin's every turn."
    duration: {
      turns: k.param("02", 2),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: [{ stat: "dmgBoost", value: k.param("02", 1) }],
  });

  const concertoAllyModifiers: ModifierDef[] = [
    {
      stat: "atkFlat",
      value: k.param("03", 3),
      scaling: { source: "applier", stat: "atk", ratio: k.param("03", 1) },
    },
  ];
  if (k.a(2)) {
    concertoAllyModifiers.push({
      stat: "critDmg",
      value: k.traceParam(2, 1),
      filter: { tags: ["followUp"] },
    });
  }
  if (k.e(1))
    concertoAllyModifiers.push({ stat: "resPen", value: k.rankParam(1, 1) });
  if (k.e(2))
    concertoAllyModifiers.push({ stat: "spdPct", value: k.rankParam(2, 1) });

  const concertoBuff = k.status({
    id: "concerto-allies",
    origin: "ultimate",
    modifiers: concertoAllyModifiers,
  });
  const concerto = k.status({ id: "concerto", origin: "ultimate" });

  k.teamStat("talent", { stat: "critDmg", value: k.param("04", 1) });

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      ctx.advanceAction(ctx.self, k.traceParam(1, 1))
    );
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
    target: "allies",
    energy: 30 + (k.a(3) ? k.traceParam(3, 1) : 0),
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, aria);
    },
  });

  const countdown = k.summon({
    id: "concerto-countdown",
    speed: k.param("03", 2),
    policy: () => "end",
    abilities: [
      {
        id: "end",
        kind: "other",
        target: "none",
        after: (ctx) => {
          const robin = ctx.self.owner;
          if (!robin) return;
          ctx.removeStatus(robin, concerto);
          for (const ally of ctx.allies) ctx.removeStatus(ally, concertoBuff);
          ctx.setInActionOrder(robin, true);
          ctx.advanceAction(robin, 1);
          ctx.dismiss(ctx.self);
        },
      },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      ctx.applyStatus(ctx.self, concerto);
      for (const ally of ctx.allies) ctx.applyStatus(ally, concertoBuff);
      ctx.setCounter(ctx.self, "moonless-midnight", 0);
      ctx.summon(ctx.self, countdown.id);
      ctx.setInActionOrder(ctx.self, false);
      for (const ally of ctx.allies) {
        if (ally !== ctx.self) ctx.advanceAction(ally, 1);
      }
    },
  });

  const additional = k.param("03", 4);
  const fixedCritRate = k.param("03", 5);
  const fixedCritDmg = k.param("03", 6);
  k.on(
    "actionEnd",
    "ultimate",
    { subject: "ally", attack: true },
    (ctx, event) => {
      if (!ctx.self.has(concerto) || !isEnemy(event.target)) return;
      const boosted =
        k.e(6) && ctx.self.counter("moonless-midnight") < k.rankParam(6, 1);
      if (boosted) ctx.addCounter(ctx.self, "moonless-midnight", 1);
      ctx.deal(
        {
          shape: "single",
          main: additional,
          onlyTags: ["additional"],
          critOverride: {
            critRate: fixedCritRate,
            critDmg: fixedCritDmg + (boosted ? k.rankParam(6, 2) : 0),
          },
        },
        { targets: [event.target], origin: "ultimate" }
      );
    }
  );

  const talentEnergy = k.param("04", 2) + (k.e(2) ? k.rankParam(2, 2) : 0);
  k.on("actionEnd", "talent", { subject: "ally", attack: true }, (ctx) =>
    ctx.gainEnergy(ctx.self, talentEnergy)
  );
});
