import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Trailblazer (Destruction) — Destruction, Physical. */
export default defineCharacter("8001", (k) => {
  const pickoffModifiers: ModifierDef[] = [
    { stat: "atkPct", value: k.param("04", 1) },
  ];
  if (k.a(2))
    pickoffModifiers.push({ stat: "defPct", value: k.traceParam(2, 1) });
  const perfectPickoff = k.status({
    id: "perfect-pickoff",
    origin: "talent",
    maxStacks: k.param("04", 2),
    modifiers: pickoffModifiers,
  });

  // A6 only boosts DMG to the designated target. It is applied before the
  // hits and dropped after the first damage instance, which the engine always
  // resolves on the main target before adjacent ones.
  const fightingWill = k.status({
    id: "fighting-will",
    origin: "a6",
    modifiers: [{ stat: "dmgBoost", value: k.traceParam(3, 1) }],
  });
  if (k.a(3)) {
    k.on("hit", "a6", { subject: "self" }, (ctx) => {
      if (ctx.self.has(fightingWill)) ctx.removeStatus(ctx.self, fightingWill);
    });
  }

  // Ultimate mode is the player's choice; the engine casts one Ultimate, so
  // it is an option. RIP Home Run is the default for multi-enemy fights.
  const ripHomeRun = k.toggle("rip-home-run", "ultimate", "active", true);

  // Kills are not simulated: when enabled, every Ultimate defeats an enemy.
  const e1Kill = k.e(1) && k.toggle("e1-ultimate-kill", "e1", "active", false);
  const e6Kill = k.e(6) && k.toggle("e6-kill", "e6", "active", false);

  k.on("weaknessBreak", "talent", { subject: "self" }, (ctx) =>
    ctx.applyStatus(ctx.self, perfectPickoff)
  );

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(1, 1))
    );
  }

  if (k.e(4)) {
    // Approximation: the designated target's Weakness Broken state at the
    // start of the action decides the CRIT Rate for every target hit.
    const destructingGlance = k.status({
      id: "destructing-glance",
      origin: "e4",
      modifiers: [{ stat: "critRate", value: k.rankParam(4, 1) }],
    });
    k.on("actionStart", "e4", { subject: "self", attack: true }, (ctx, e) => {
      if (isEnemy(e.target) && e.target.broken) {
        ctx.applyStatus(ctx.self, destructingGlance);
      }
    });
    k.on("actionEnd", "e4", { subject: "self" }, (ctx) =>
      ctx.removeStatus(ctx.self, destructingGlance)
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
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 1),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    before: (ctx) => {
      if (k.a(3)) ctx.applyStatus(ctx.self, fightingWill);
    },
    after: (ctx) => ctx.removeStatus(ctx.self, fightingWill),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      ripHomeRun
        ? {
            shape: "blast",
            main: k.param("09", 1),
            adjacent: k.param("09", 2),
            toughness: { main: 20, adjacent: 20 },
          }
        : { shape: "single", main: k.param("08", 1), toughness: { main: 30 } },
    ],
    before: (ctx) => {
      if (ripHomeRun && k.a(3)) ctx.applyStatus(ctx.self, fightingWill);
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, fightingWill);
      if (e1Kill) ctx.gainEnergy(ctx.self, k.rankParam(1, 1));
      if (e6Kill) ctx.applyStatus(ctx.self, perfectPickoff);
    },
  });
});
