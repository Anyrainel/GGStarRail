import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Dan Heng — The Hunt, Wind. */
export default defineCharacter("1002", (k) => {
  // Enemy SPD is fixed in the engine; the Slow matters for its presence.
  const slow = k.status({
    id: "torrent-slow",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 3) },
    modifiers: [
      {
        stat: "spdPct",
        value: -(k.param("02", 2) + (k.e(6) ? k.rankParam(6, 1) : 0)),
      },
    ],
  });

  const etherealDream = k.status({
    id: "ethereal-dream",
    origin: "ultimate",
    modifiers: [
      {
        stat: "multiplierBoost",
        value: k.param("03", 2),
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  const highGale = k.status({
    id: "high-gale",
    origin: "a6",
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.traceParam(3, 1),
        filter: { tags: ["basic"] },
      },
    ],
  });

  // Talent: the engine does not expose which ally an ability targets, so
  // the option assumes an ally targets Dan Heng whenever it is off
  // cooldown, checked at the start of his turns.
  const reach = k.status({
    id: "superiority-of-reach",
    origin: "talent",
    modifiers: [
      {
        stat: "resPen",
        value: k.param("04", 1),
        filter: { combatTypes: ["Wind"] },
      },
    ],
  });
  if (k.toggle("talent-ally-target", "talent", "active", true)) {
    // E2: "Reduces Talent cooldown by 1 turn."
    const cooldown = k.param("04", 2) - (k.e(2) ? 1 : 0);
    k.on("turnStart", "talent", {}, (ctx) => {
      if (ctx.self.counter("reach-cooldown") > 0) return;
      ctx.applyStatus(ctx.self, reach);
      ctx.setCounter(ctx.self, "reach-cooldown", cooldown);
    });
    k.on("turnEnd", "talent", {}, (ctx) => {
      const remaining = ctx.self.counter("reach-cooldown");
      if (remaining > 0)
        ctx.setCounter(ctx.self, "reach-cooldown", remaining - 1);
    });
    k.on("actionEnd", "talent", { attack: true }, (ctx) =>
      ctx.removeStatus(ctx.self, reach)
    );
  }

  if (k.a(2)) {
    // A fixed 50% chance per attack refreshes a 2-turn SPD Boost; attacking
    // every turn, it is up with probability 1 − (1 − 50%)^2, applied as its
    // expected SPD.
    const uptime = 1 - (1 - k.traceParam(2, 1)) ** k.traceParam(2, 3);
    const fasterThanLight = k.status({
      id: "faster-than-light",
      origin: "a4",
      duration: { turns: k.traceParam(2, 3) },
      modifiers: [{ stat: "spdPct", value: k.traceParam(2, 2) * uptime }],
    });
    k.on("actionEnd", "a4", { attack: true }, (ctx) =>
      ctx.applyStatus(ctx.self, fasterThanLight)
    );
  }

  if (k.e(1)) {
    const highHp = k.toggle(
      "e1-enemy-hp",
      "e1",
      "enemyHpAbove",
      true,
      k.rankParam(1, 1)
    );
    if (highHp) k.stat("e1", { stat: "critRate", value: k.rankParam(1, 2) });
  }
  const ultimateKill =
    k.e(4) && k.toggle("e4-kill", "e4", "enemyDefeated", false);

  k.ability({
    id: "basic",
    kind: "basic",
    before: (ctx) => {
      if (k.a(3) && isEnemy(ctx.target) && ctx.target.has(slow)) {
        ctx.applyStatus(ctx.self, highGale);
      }
    },
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => ctx.removeStatus(ctx.self, highGale),
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    // The Slow needs a CRIT Hit. CRIT Rate is a build stat outside the
    // timeline, so the Skill is assumed to CRIT (tracked as approximation).
    after: (ctx) => {
      if (isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, slow, { baseChance: k.param("02", 4) });
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (isEnemy(ctx.target) && ctx.target.has(slow)) {
        ctx.applyStatus(ctx.self, etherealDream);
      }
    },
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => {
      ctx.removeStatus(ctx.self, etherealDream);
      if (ultimateKill) ctx.advanceAction(ctx.self, 1);
    },
  });

  k.policy({
    // Hold the Ultimate for a Slowed target unless no Skill Point can apply it.
    ultimate: (view) =>
      view.enemies.some((enemy) => enemy.has(slow)) || view.skillPoints < 1,
  });
});
