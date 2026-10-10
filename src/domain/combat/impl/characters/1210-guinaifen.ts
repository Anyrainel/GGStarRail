import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
} from "../../kit/api";
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
  // Characters): a Fire DoT. Statuses have no DoT family, so Burns are
  // recognized by Combat Type and collected as they are applied.
  const isBurn = (status: StatusDef | undefined) =>
    status?.dot?.hit.combatType === "Fire";
  const knownBurns = new Set<StatusDef>(ownBurns);
  k.on("statusApplied", "talent", { subject: "any" }, (_ctx, event) => {
    if (event.status && isBurn(event.status)) knownBurns.add(event.status);
  });
  const burned = (enemy: EnemyView) =>
    [...knownBurns].some((status) => enemy.has(status));

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

  // A6 for her direct hits: the Engine has no target-state filter, so the
  // bonus follows the main target's Burn when the action starts. Her own
  // Burn ticks only ever hit Burned enemies.
  const walkingOnKnives = k.status({
    id: "walking-on-knives",
    origin: "a6",
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.traceParam(3, 1),
        filter: { tags: ["basic", "skill", "ultimate"] },
      },
    ],
  });
  if (k.a(3)) {
    k.stat("a6", {
      stat: "dmgBoost",
      value: k.traceParam(3, 1),
      filter: { tags: ["dot"] },
    });
  }
  const syncWalkingOnKnives = (ctx: ActionContext) => {
    if (!k.a(3)) return;
    if (isEnemy(ctx.target) && burned(ctx.target)) {
      ctx.applyStatus(ctx.self, walkingOnKnives);
    } else {
      ctx.removeStatus(ctx.self, walkingOnKnives);
    }
  };

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
    before: syncWalkingOnKnives,
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
    before: syncWalkingOnKnives,
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
    before: syncWalkingOnKnives,
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.detonateDots(enemy, k.param("03", 2), { filter: isBurn });
      }
    },
  });

  // Firekiss follows every Burn tick or detonation, from any source.
  k.on("dotTick", "talent", { subject: "enemy" }, (ctx, event) => {
    if (!isBurn(event.status) || !isEnemy(event.unit)) return;
    ctx.applyStatus(event.unit, firekiss, { baseChance: k.param("04", 1) });
  });

  if (k.e(4)) {
    k.on("dotTick", "e4", { subject: "enemy" }, (ctx, event) => {
      if (event.status && ownBurns.includes(event.status)) {
        ctx.gainEnergy(ctx.self, k.rankParam(4, 1));
      }
    });
  }
});
