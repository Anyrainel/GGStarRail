import type { ActionContext } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Argenti — Erudition, Physical. */
export default defineCharacter("1302", (k) => {
  const apotheosisModifiers: ModifierDef[] = [
    { stat: "critRate", value: k.param("04", 2) },
  ];
  if (k.e(1)) {
    apotheosisModifiers.push({ stat: "critDmg", value: k.rankParam(1, 1) });
  }
  const apotheosis = k.status({
    id: "apotheosis",
    origin: "talent",
    maxStacks: k.param("04", 3) + (k.e(4) ? k.rankParam(4, 2) : 0),
    modifiers: apotheosisModifiers,
  });

  // Talent: Energy and one Apotheosis stack per enemy hit by Basic ATK,
  // Skill, or Ultimate, granted after each HitDef so stacks from the AoE part
  // raise the CRIT Rate of the bounces. The AoE part hits every enemy, so the
  // bounces add none.
  const sublimeObject = (ctx: ActionContext, enemiesHit: number) => {
    ctx.gainEnergy(ctx.self, k.param("04", 1) * enemiesHit);
    ctx.applyStatus(ctx.self, apotheosis, { stacks: enemiesHit });
  };

  if (k.a(1)) {
    k.on("turnStart", "a2", {}, (ctx) =>
      ctx.applyStatus(ctx.self, apotheosis, { stacks: k.traceParam(1, 1) })
    );
  }

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(2, 1) * ctx.enemies.length)
    );
  }

  if (k.a(3)) {
    const lowHp = k.toggle(
      "a6-enemy-hp",
      "a6",
      "enemyHpBelow",
      true,
      k.traceParam(3, 1)
    );
    if (lowHp) k.stat("a6", { stat: "dmgBoost", value: k.traceParam(3, 2) });
  }

  if (k.e(4)) {
    k.on("battleStart", "e4", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, apotheosis, { stacks: k.rankParam(4, 1) })
    );
  }

  if (k.e(6)) {
    k.stat("e6", {
      stat: "defIgnore",
      value: k.rankParam(6, 1),
      filter: { tags: ["ultimate"] },
    });
  }

  const agate = k.status({
    id: "agates-humility",
    origin: "e2",
    duration: { turns: k.rankParam(2, 3) },
    modifiers: [{ stat: "atkPct", value: k.rankParam(2, 2) }],
  });

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    afterHit: (ctx) => sublimeObject(ctx, 1),
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [{ shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } }],
    afterHit: (ctx) => sublimeObject(ctx, ctx.enemies.length),
  });

  const ultimateBefore = (ctx: ActionContext) => {
    if (k.e(2) && ctx.enemies.length >= k.rankParam(2, 1)) {
      ctx.applyStatus(ctx.self, agate);
    }
  };

  // The 180-Energy Ultimate is the one cast: it out-damages two 90-Energy
  // casts on any target count.
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    energyCost: k.param("14", 4),
    before: ultimateBefore,
    hits: [
      { shape: "aoe", each: k.param("14", 1), toughness: { each: 20 } },
      {
        shape: "bounce",
        bounces: k.param("14", 2),
        each: k.param("14", 3),
        toughness: { each: 5 },
      },
    ],
    afterHit: (ctx, index) => {
      if (index === 0) sublimeObject(ctx, ctx.enemies.length);
    },
  });

  // The 90-Energy Ultimate. Never chosen: it only pays when 180 Energy cannot
  // be reached before the battle ends (tracker argenti-90-ultimate).
  k.ability({
    id: "ultimateLesser",
    kind: "ultimate",
    energyCost: k.param("03", 2),
    before: ultimateBefore,
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    afterHit: (ctx) => sublimeObject(ctx, ctx.enemies.length),
  });
});
