import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { StatusDef } from "../../kit/model";
import type { CombatType } from "../../model/stats";

const COMBAT_TYPES: readonly CombatType[] = [
  "Physical",
  "Fire",
  "Ice",
  "Thunder",
  "Wind",
  "Quantum",
  "Imaginary",
];
const BUG_COUNTER = "silver-wolf:next-bug";
const IMPLANT_COUNTER = "silver-wolf:implanted-type";

/** Silver Wolf — Nihility, Quantum. */
export default defineCharacter("1006", (k) => {
  // Bugs are random: they are implanted in rotation per enemy, so after three
  // attacks an enemy holds all three (tracked as an approximation). Enemy
  // attacks deal a fixed share of HP, so the ATK Bug only counts as a debuff.
  const bugTurns = k.param("04", 5) + (k.a(1) ? k.traceParam(1, 1) : 0);
  const bugs: readonly StatusDef[] = [
    k.status({
      id: "bug-def",
      origin: "talent",
      debuff: true,
      duration: { turns: bugTurns },
      modifiers: [{ stat: "defReduction", value: k.param("04", 2) }],
    }),
    k.status({
      id: "bug-atk",
      origin: "talent",
      debuff: true,
      duration: { turns: bugTurns },
    }),
    k.status({
      id: "bug-spd",
      family: "slow",
      origin: "talent",
      debuff: true,
      duration: { turns: bugTurns },
      modifiers: [{ stat: "spdPct", value: -k.param("04", 3) }],
    }),
  ];
  const implantBug = (ctx: BattleApi, enemy: EnemyView, baseChance: number) => {
    const index = enemy.counter(BUG_COUNTER) % bugs.length;
    ctx.setCounter(enemy, BUG_COUNTER, index + 1);
    const bug = bugs[index];
    if (bug) ctx.applyStatus(enemy, bug, { baseChance });
  };

  const implantTurns = k.param("02", 3) + (k.a(2) ? k.traceParam(2, 1) : 0);
  const implantRes = new Map<CombatType, StatusDef>(
    COMBAT_TYPES.map((type) => [
      type,
      k.status({
        id: `implant-${type}`,
        origin: "skill",
        debuff: true,
        duration: { turns: implantTurns },
        modifiers: [
          {
            stat: "resReduction",
            value: k.param("02", 4),
            filter: { combatTypes: [type] },
          },
        ],
      }),
    ])
  );
  // A Weakness the enemy already had: implanted without the RES reduction.
  const implantNative = k.status({
    id: "implant-native",
    origin: "skill",
    debuff: true,
    duration: { turns: implantTurns },
  });

  // The Type is "an on-field character's Type", chosen at random among those
  // the enemy is not weak to; here the first such ally in team order. The
  // Weakness lasts as long as its RES reduction, and the counter remembers
  // the Type implanted last so only the most recent one is kept.
  const implant = (ctx: ActionContext, enemy: EnemyView) => {
    const previous = COMBAT_TYPES[enemy.counter(IMPLANT_COUNTER) - 1];
    const native = (type: CombatType) =>
      enemy.weaknesses.has(type) && type !== previous;
    const type = ctx.allies
      .filter((ally) => ally.kind === "character")
      .map((ally) => ally.combatType)
      .find((candidate) => !native(candidate));
    for (const status of [...implantRes.values(), implantNative]) {
      ctx.removeStatus(enemy, status);
    }
    const baseChance = k.param("02", 2);
    const status = type ? implantRes.get(type) : undefined;
    if (!type || !status) {
      ctx.applyStatus(enemy, implantNative, { baseChance });
      return;
    }
    if (previous && previous !== type) ctx.removeWeakness(enemy, previous);
    ctx.implantWeakness(enemy, type, { turns: implantTurns });
    ctx.setCounter(enemy, IMPLANT_COUNTER, COMBAT_TYPES.indexOf(type) + 1);
    ctx.applyStatus(enemy, status, { baseChance });
  };

  const allResDown = k.status({
    id: "allow-changes-res",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 7) },
    modifiers: [{ stat: "resReduction", value: k.param("02", 6) }],
  });
  // A6 deepens the same debuff; a companion status so it counts once.
  const sideNote = k.status({
    id: "side-note",
    origin: "a6",
    duration: { turns: k.param("02", 7) },
    modifiers: [{ stat: "resReduction", value: k.traceParam(3, 2) }],
  });

  const userBanned = k.status({
    id: "user-banned",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 4) },
    modifiers: [{ stat: "defReduction", value: k.param("03", 3) }],
  });

  // E6 depends on the target's debuffs; all her attacks are single-target,
  // so the stacks are synced to the target before each hit.
  const overlayMax = Math.round(k.rankParam(6, 2) / k.rankParam(6, 1));
  const overlay = k.status({
    id: "overlay-network",
    origin: "e6",
    maxStacks: overlayMax,
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(6, 1) }],
  });
  const aim = (ctx: BattleApi, enemy: EnemyView) => {
    if (!k.e(6)) return;
    ctx.applyStatus(ctx.self, overlay, {
      setStacks: Math.min(overlayMax, enemy.debuffCount()),
    });
  };

  // E2 (Effect RES −#1 on entering combat) is not modeled: enemy Effect RES
  // has no modifier (tracked as engine-gap).

  if (k.a(1)) {
    k.on("weaknessBreak", "a2", { subject: "ally" }, (ctx, event) => {
      if (isEnemy(event.target)) {
        implantBug(ctx, event.target, k.traceParam(1, 2));
      }
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    before: (ctx) => {
      if (isEnemy(ctx.target)) aim(ctx, ctx.target);
    },
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) implantBug(ctx, ctx.target, k.param("04", 4));
    },
  });

  // The Skill text lists its debuffs before the DMG: they apply to it.
  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      const target = ctx.target;
      const deepened = k.a(3) && target.debuffCount() >= k.traceParam(3, 1);
      implant(ctx, target);
      ctx.applyStatus(target, allResDown, { baseChance: k.param("02", 5) });
      if (deepened) {
        ctx.applyStatus(target, sideNote, { baseChance: k.param("02", 5) });
      } else {
        ctx.removeStatus(target, sideNote);
      }
      aim(ctx, target);
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) implantBug(ctx, ctx.target, k.param("04", 4));
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      ctx.applyStatus(ctx.target, userBanned, {
        baseChance: k.param("03", 2),
      });
      aim(ctx, ctx.target);
    },
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      const target = ctx.target;
      // E1/E4 count the debuffs present before this attack's Bug.
      if (k.e(1)) {
        const count = Math.min(target.debuffCount(), k.rankParam(1, 2));
        ctx.gainEnergy(ctx.self, count * k.rankParam(1, 1));
      }
      if (k.e(4)) {
        const count = Math.min(target.debuffCount(), k.rankParam(4, 2));
        for (let index = 0; index < count; index += 1) {
          ctx.deal(
            {
              shape: "single",
              main: k.rankParam(4, 1),
              onlyTags: ["additional"],
            },
            { targets: [target], origin: "e4" }
          );
        }
      }
      implantBug(ctx, target, k.param("04", 4));
    },
  });
});
