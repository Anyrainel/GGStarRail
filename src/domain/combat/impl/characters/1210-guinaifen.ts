import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { StatusDef } from "../../kit/model";

/** Guinaifen — Nihility, Fire. */
export default defineCharacter("1210", (k) => {
  const burnDuration = { turns: k.param("02", 5) };
  const burn = k.status({
    id: "burn",
    family: "burn",
    origin: "skill",
    debuff: true,
    duration: burnDuration,
    dot: {
      hit: {
        shape: "single",
        main: k.param("02", 4),
        kind: "dot",
        combatType: "Fire",
      },
    },
  });
  // E2: a Burn from Basic ATK/Skill on an already Burned enemy has a higher
  // multiplier. It replaces the plain Burn, so the two never coexist.
  const boostedBurn = k.e(2)
    ? k.status({
        id: "burn-e2",
        family: "burn",
        origin: "skill",
        debuff: true,
        duration: burnDuration,
        dot: {
          hit: {
            shape: "single",
            main: k.param("02", 4) + k.rankParam(2, 1),
            kind: "dot",
            combatType: "Fire",
          },
        },
      })
    : null;
  const ownBurns: readonly StatusDef[] = boostedBurn
    ? [burn, boostedBurn]
    : [burn];
  // "Burn" is any Burn, whatever its source (Weakness Break, other
  // Characters): the burn family.
  const isBurn = (status: StatusDef | undefined) => status?.family === "burn";
  const burned = (enemy: EnemyView) => enemy.hasFamily("burn");

  const applyBurn = (ctx: BattleApi, enemy: EnemyView, baseChance: number) => {
    const status = boostedBurn && burned(enemy) ? boostedBurn : burn;
    for (const other of ownBurns) {
      if (other !== status) ctx.removeStatus(enemy, other);
    }
    ctx.applyStatus(enemy, status, { baseChance });
  };

  const firekiss = k.status({
    id: "firekiss",
    origin: "talent",
    debuff: true,
    duration: { turns: k.param("04", 5) },
    maxStacks: k.param("04", 6) + (k.e(6) ? k.rankParam(6, 1) : 0),
    modifiers: [{ stat: "vulnerability", value: k.param("04", 4) }],
  });

  if (k.a(3)) {
    k.stat("a6", {
      stat: "dmgBoost",
      value: k.traceParam(3, 1),
      filter: { targetFamilies: ["burn"] },
    });
  }

  // E1 (Effect RES −#2 on Skill targets) is not modeled: enemy Effect RES
  // reductions have no stat.

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.advanceAction(ctx.self, k.traceParam(2, 1))
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (k.a(1) && isEnemy(ctx.target)) {
        applyBurn(ctx, ctx.target, k.traceParam(1, 1));
      }
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      const index = ctx.enemies.indexOf(ctx.target);
      for (const enemy of [
        ctx.enemies[index - 1],
        ctx.target,
        ctx.enemies[index + 1],
      ]) {
        if (enemy) applyBurn(ctx, enemy, k.param("02", 3));
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.detonateDots(enemy, k.param("03", 2), { filter: isBurn });
      }
    },
  });

  // Firekiss follows every Burn tick or detonation, from any source.
  k.on(
    "dotTick",
    "talent",
    { subject: "enemy", when: (event) => isBurn(event.status) },
    (ctx, event) => {
      if (!isEnemy(event.unit)) return;
      ctx.applyStatus(event.unit, firekiss, { baseChance: k.param("04", 1) });
    }
  );

  if (k.e(4)) {
    k.on("dotTick", "e4", { subject: "enemy" }, (ctx, event) => {
      if (event.status && ownBurns.includes(event.status)) {
        ctx.gainEnergy(ctx.self, k.rankParam(4, 1));
      }
    });
  }
});
