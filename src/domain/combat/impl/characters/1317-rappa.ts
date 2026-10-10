import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Rappa — Erudition, Imaginary. */
export default defineCharacter("1317", (k) => {
  const CHARGE = "rappa:charge";
  const CHROMA_INK = "rappa:chroma-ink";
  const maxCharge = k.param("04", 1) + (k.e(6) ? k.rankParam(6, 2) : 0);

  const sealformModifiers: ModifierDef[] = [
    { stat: "breakEfficiency", value: k.param("03", 1) },
    { stat: "breakEffect", value: k.param("03", 2) },
  ];
  if (k.a(2)) {
    // Enhanced Basic ATK is the only Basic ATK usable in Sealform; its
    // Toughness Reduction on Broken enemies becomes Super Break DMG.
    sealformModifiers.push({
      stat: "superBreakDmg",
      value: k.traceParam(2, 1),
      filter: { tags: ["basic"] },
    });
  }
  if (k.e(1)) {
    sealformModifiers.push({ stat: "defIgnore", value: k.rankParam(1, 1) });
  }
  const sealform = k.status({
    id: "sealform",
    origin: "ultimate",
    modifiers: sealformModifiers,
  });

  const e4Speed = k.status({
    id: "e4-sealform-spd",
    origin: "e4",
    modifiers: [{ stat: "spdPct", value: k.rankParam(4, 1) }],
  });

  const witheredLeaf = k.status({
    id: "withered-leaf",
    origin: "a6",
    debuff: true,
    duration: { turns: k.traceParam(3, 5) },
    modifiers: [
      {
        stat: "vulnerability",
        value: k.traceParam(3, 1),
        // "for every 100 excess ATK" has no placeholder.
        scaling: {
          source: "applier",
          stat: "atk",
          threshold: k.traceParam(3, 2),
          step: 100,
          ratio: k.traceParam(3, 3),
          cap: k.traceParam(3, 4),
        },
        filter: { tags: ["break"] },
      },
    ],
  });

  // Enemy tiers are not modeled: the centre enemy (the scenario's main
  // target, the boss of "boss with adds") counts as elite for A2.
  const isElite = (ctx: BattleApi, target: EnemyView) =>
    ctx.enemies[Math.floor((ctx.enemies.length - 1) / 2)] === target;

  k.on("weaknessBreak", "talent", { subject: "ally" }, (ctx, event) => {
    ctx.addCounter(ctx.self, CHARGE, 1, maxCharge);
    if (!isEnemy(event.target)) return;
    if (k.a(1) && isElite(ctx, event.target)) {
      ctx.addCounter(ctx.self, CHARGE, k.traceParam(1, 2), maxCharge);
      ctx.gainEnergy(ctx.self, k.traceParam(1, 1));
    }
    if (k.a(3)) ctx.applyStatus(event.target, witheredLeaf);
  });

  if (k.e(6)) {
    k.on("battleStart", "e6", { subject: "any" }, (ctx) =>
      ctx.addCounter(ctx.self, CHARGE, k.rankParam(6, 1), maxCharge)
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
    hits: [{ shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } }],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    usable: (view) => !view.self.has(sealform),
    before: (ctx) => {
      ctx.applyStatus(ctx.self, sealform);
      ctx.setCounter(ctx.self, CHROMA_INK, k.param("03", 3));
      if (k.e(4)) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, e4Speed);
      }
      ctx.grantExtraTurn(ctx.self);
    },
  });

  // Facts give 25 (main) / 15 (adjacent) Toughness in total: 10/5 for each
  // of the first two hits and 5 to every enemy for the third.
  // Enemies without Imaginary Weakness take 50% of the Toughness Reduction.
  const withoutWeakness = k.param("18", 4);
  const firstHits = {
    shape: "blast",
    main: k.param("18", 1),
    adjacent: k.param("18", 2),
    toughness: {
      main: 10 * (k.e(2) ? 1 + k.rankParam(2, 1) : 1),
      adjacent: 5,
    },
    toughnessWithoutWeakness: withoutWeakness,
  } as const;

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    skillPoints: 0,
    energy: 0,
    hits: [
      firstHits,
      firstHits,
      {
        shape: "aoe",
        each: k.param("18", 3),
        toughness: { each: 5 },
        toughnessWithoutWeakness: withoutWeakness,
      },
    ],
    after: (ctx) => {
      // Talent: with the third hit, Break DMG to all enemies, consuming all
      // Charge.
      const charge = ctx.self.counter(CHARGE);
      ctx.deal(
        {
          shape: "aoe",
          kind: "break",
          each: k.param("04", 3) + k.param("04", 5) * charge,
          onlyTags: ["break"],
          toughness: { each: k.param("04", 4) + k.param("04", 6) * charge },
          toughnessWithoutWeakness: 1,
        },
        { origin: "talent" }
      );
      ctx.setCounter(ctx.self, CHARGE, 0);
      if (k.e(6)) {
        ctx.addCounter(ctx.self, CHARGE, k.rankParam(6, 1), maxCharge);
      }
      ctx.addCounter(ctx.self, CHROMA_INK, -1);
      if (ctx.self.counter(CHROMA_INK) > 1e-9) return;
      ctx.removeStatus(ctx.self, sealform);
      for (const ally of ctx.allies) ctx.removeStatus(ally, e4Speed);
      if (k.e(1)) ctx.gainEnergy(ctx.self, k.rankParam(1, 2));
    },
  });

  // Skill (AoE) outside Sealform; Enhanced Basic ATK for every Sealform turn.
  k.policy({
    turn: (view) =>
      view.self.has(sealform)
        ? "enhancedBasic"
        : view.skillPoints >= 1
          ? "skill"
          : "basic",
  });
});
