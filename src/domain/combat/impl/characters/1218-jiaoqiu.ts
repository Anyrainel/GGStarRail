import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Jiaoqiu — Nihility, Fire. */
export default defineCharacter("1218", (k) => {
  const roastTurns = k.param("04", 5);
  const perStack = k.param("04", 3);

  // Ashen Roast: DMG taken +#2 at 1 stack and +#3 per further stack, i.e.
  // #3 per stack here plus (#2 − #3) once on the companion status below.
  const roastStackModifiers: ModifierDef[] = [
    { stat: "vulnerability", value: perStack },
  ];
  if (k.e(6)) {
    roastStackModifiers.push({
      stat: "resReduction",
      value: k.rankParam(6, 3),
    });
  }
  const ashenRoast = k.status({
    id: "ashen-roast",
    origin: "talent",
    debuff: true,
    duration: { turns: roastTurns },
    maxStacks: k.e(6) ? k.rankParam(6, 2) : k.param("04", 4),
    modifiers: roastStackModifiers,
  });
  // The flat part and the Burn DoT (one DoT regardless of stacks). It is the
  // same in-game debuff, so it is not flagged as a second debuff.
  const ashenRoastBurn = k.status({
    id: "ashen-roast-burn",
    family: "burn",
    origin: "talent",
    duration: { turns: roastTurns },
    modifiers: [{ stat: "vulnerability", value: k.param("04", 2) - perStack }],
    dot: {
      hit: {
        shape: "single",
        main: k.param("04", 6) + (k.e(2) ? k.rankParam(2, 1) : 0),
        kind: "dot",
      },
    },
  });

  const inflict = (
    ctx: BattleApi,
    enemy: EnemyView,
    options: { stacks?: number; setStacks?: number; baseChance?: number }
  ) => {
    const chance =
      options.baseChance === undefined
        ? {}
        : { baseChance: options.baseChance };
    ctx.applyStatus(enemy, ashenRoast, {
      ...chance,
      ...(options.setStacks === undefined
        ? { stacks: options.stacks ?? 1 }
        : { setStacks: options.setStacks }),
    });
    ctx.applyStatus(enemy, ashenRoastBurn, chance);
  };

  // "Its duration decreases by 1 at the start of this unit's every turn."
  const zoneDuration = {
    turns: k.param("03", 4),
    countdown: "turnStart" as const,
  };
  const zone = k.status({
    id: "pyrograph-arcanum",
    origin: "ultimate",
    duration: zoneDuration,
  });
  // The Zone is a field rather than a debuff on each enemy.
  const zoneField = k.status({
    id: "pyrograph-arcanum-field",
    origin: "ultimate",
    duration: { ...zoneDuration, clock: "applier" },
    modifiers: [
      {
        stat: "vulnerability",
        value: k.param("03", 3),
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(1, 1))
    );
  }

  if (k.a(2)) {
    k.stat("a4", {
      stat: "atkPct",
      scaling: {
        source: "holder",
        stat: "effectHitRate",
        threshold: k.traceParam(2, 1),
        step: k.traceParam(2, 2),
        ratio: k.traceParam(2, 3),
        cap: k.traceParam(2, 4),
      },
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
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) {
        inflict(ctx, ctx.target, { baseChance: k.param("02", 3) });
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      const highest = Math.max(
        0,
        ...ctx.enemies.map((enemy) => enemy.stacks(ashenRoast))
      );
      if (highest > 0) {
        for (const enemy of ctx.enemies) {
          inflict(ctx, enemy, { setStacks: highest });
        }
      }
      ctx.applyStatus(ctx.self, zone);
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, zoneField);
      ctx.setCounter(ctx.self, "zone-triggers", 0);
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
  });

  // Zone: enemies taking action gain a stack (#2 base chance), at most #5
  // times per Ultimate. "Taking action" is the enemy's attack, after DoTs.
  // Not modeled: A6 (enemies joining mid-battle), E4 (enemy ATK), and the E6
  // stack transfer on defeat (no reinforcements or kills in the engine).
  k.on("enemyAttack", "ultimate", { subject: "enemy" }, (ctx, event) => {
    const enemy = event.unit;
    if (!isEnemy(enemy) || !ctx.self.has(zone)) return;
    if (ctx.self.counter("zone-triggers") >= k.param("03", 5)) return;
    ctx.addCounter(ctx.self, "zone-triggers", 1);
    inflict(ctx, enemy, { baseChance: k.param("03", 2) });
  });

  const talentStacks = 1 + (k.e(1) ? k.rankParam(1, 2) : 0);
  k.on(
    "hit",
    "talent",
    { subject: "self", abilityKinds: ["basic", "skill", "ultimate"] },
    (ctx, event) => {
      if (!isEnemy(event.target)) return;
      inflict(ctx, event.target, {
        stacks: talentStacks,
        baseChance: k.param("04", 1),
      });
    }
  );

  if (k.e(1)) {
    k.teamStat(
      "e1",
      {
        stat: "dmgBoost",
        value: k.rankParam(1, 1),
        filter: { targetStatuses: [ashenRoast.id] },
      },
      "allies"
    );
  }
});
