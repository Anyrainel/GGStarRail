import { type ActionContext, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Welt — Nihility, Imaginary. */
export default defineCharacter("1004", (k) => {
  const slow = k.status({
    id: "edge-of-the-void-slow",
    family: "slow",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 4) },
    modifiers: [{ stat: "spdPct", value: -k.param("02", 3) }],
  });
  const imprisoned = k.status({
    id: "synthetic-black-hole-imprisonment",
    family: "imprisonment",
    origin: "ultimate",
    debuff: true,
    // "Imprisoned for 1 turn" has no placeholder.
    duration: { turns: 1 },
    modifiers: [{ stat: "spdPct", value: -k.param("03", 4) }],
  });
  // "Already Slowed" counts any Slow, plus Imprisonment (its SPD reduction),
  // including other kits' and Imaginary Break's.
  const isSlowed = (enemy: EnemyView) =>
    enemy.hasFamily("slow") || enemy.hasFamily("imprisonment");

  const retribution = k.status({
    id: "retribution",
    origin: "a2",
    debuff: true,
    duration: { turns: k.traceParam(1, 3) },
    modifiers: [{ stat: "vulnerability", value: k.traceParam(1, 2) }],
  });

  const legacy = k.status({
    id: "legacy-of-honor",
    origin: "e1",
    maxStacks: k.rankParam(1, 3),
  });
  const legacyRider = (ctx: ActionContext, multiplier: number) => {
    if (!k.e(1) || !ctx.self.has(legacy) || !isEnemy(ctx.target)) return;
    ctx.consumeStacks(ctx.self, legacy, 1);
    ctx.deal(
      { shape: "single", main: multiplier, onlyTags: ["additional"] },
      { targets: [ctx.target], origin: "e1" }
    );
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => legacyRider(ctx, k.rankParam(1, 1) * k.param("01", 1)),
  });

  // "Additionally deals 2 instances of DMG" (E6: "1 extra time") have no
  // placeholder. Bounce facts list Energy per hit (10), so it is ×hits.
  const bounces = 2 + (k.e(6) ? 1 : 0);
  k.ability({
    id: "skill",
    kind: "skill",
    energy: 10 * (1 + bounces),
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 10 } },
      {
        shape: "bounce",
        each: k.param("02", 1),
        bounces,
        toughness: { each: 10 },
      },
    ],
    after: (ctx) => legacyRider(ctx, k.rankParam(1, 2) * k.param("02", 1)),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    energy: 5 + (k.a(2) ? k.traceParam(2, 1) : 0),
    before: (ctx) => {
      if (!k.a(1)) return;
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, retribution, {
          baseChance: k.traceParam(1, 1),
        });
      }
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, imprisoned, { baseChance: k.param("03", 3) });
        ctx.delayAction(enemy, k.param("03", 2));
      }
      if (k.e(1)) {
        ctx.applyStatus(ctx.self, legacy, { setStacks: k.rankParam(1, 3) });
      }
    },
  });

  const slowChance = k.param("02", 2) + (k.e(4) ? k.rankParam(4, 1) : 0);
  k.on(
    "hit",
    "talent",
    { subject: "self", abilityKinds: ["basic", "skill", "ultimate"] },
    (ctx, event) => {
      const target = event.target;
      if (!isEnemy(target)) return;
      // "Already Slowed": checked before this hit's own Slow lands.
      if (isSlowed(target)) {
        ctx.deal(
          { shape: "single", main: k.param("04", 1), onlyTags: ["additional"] },
          { targets: [target], origin: "talent" }
        );
        if (k.e(2)) ctx.gainEnergy(ctx.self, k.rankParam(2, 1));
      }
      if (event.abilityKind === "skill") {
        ctx.applyStatus(target, slow, { baseChance: slowChance });
      }
    }
  );

  if (k.a(3)) {
    k.stat("a6", {
      stat: "dmgBoost",
      value: k.traceParam(3, 1),
      filter: { targetBroken: true },
    });
  }
});
