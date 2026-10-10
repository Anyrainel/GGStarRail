import {
  type BattleApi,
  type BattleEvent,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

const DREAM = "acheron:slashed-dream";
/** Ability uses that inflicted a debuff, and the last one on each enemy. */
const USE = "acheron:ability-use";
const DEBUFFED = "acheron:debuffed-in-use";
const KNOT_PENDING = "acheron:knot-pending";
const IN_ULTIMATE = "acheron:in-ultimate";

/** Acheron — Nihility, Lightning. */
export default defineCharacter("1308", (k) => {
  // Slashed Dream pays for the Ultimate instead of Energy (Talent #1).
  const maxDream = k.param("04", 1);
  k.startingEnergy(0);

  // Crimson Knot is not a debuff (her Skill would otherwise trigger her own
  // Talent) and has no stack limit in the text.
  const knot = k.status({
    id: "crimson-knot",
    origin: "talent",
    maxStacks: Number.POSITIVE_INFINITY,
  });
  // The Technique (Quadrivalent Ascendance at each wave) is not modeled, so
  // only A2 overflow grants it.
  const quadrivalent = k.status({
    id: "quadrivalent-ascendance",
    origin: "a2",
    maxStacks: k.a(1) ? k.traceParam(1, 2) : 1,
  });
  const rainleaf = k.status({
    id: "rainleaf-res",
    origin: "talent",
    modifiers: [{ stat: "resReduction", value: k.param("04", 2) }],
  });
  const thunderCore = k.status({
    id: "thunder-core",
    origin: "a6",
    duration: { turns: k.traceParam(3, 3) },
    maxStacks: k.traceParam(3, 2),
    modifiers: [{ stat: "dmgBoost", value: k.traceParam(3, 1) }],
  });

  const mainTarget = (ctx: BattleApi) =>
    ctx.enemies[Math.floor((ctx.enemies.length - 1) / 2)];
  const mostKnots = (ctx: BattleApi, fallback: EnemyView) =>
    ctx.enemies.reduce(
      (best, enemy) => (enemy.stacks(knot) > best.stacks(knot) ? enemy : best),
      fallback
    );
  const inflictKnots = (ctx: BattleApi, enemy: EnemyView, stacks: number) => {
    // "Crimson Knot cannot be applied to enemies during the Ultimate."
    if (ctx.self.counter(IN_ULTIMATE) > 0) return;
    ctx.applyStatus(enemy, knot, { stacks });
  };

  const gainDream = (ctx: BattleApi, amount: number) => {
    const total = ctx.self.counter(DREAM) + amount * ctx.weight;
    const kept = Math.min(maxDream, total);
    ctx.setCounter(ctx.self, DREAM, kept);
    if (k.a(1) && total > kept) {
      ctx.applyStatus(ctx.self, quadrivalent, { stacks: total - kept });
    }
  };

  // Talent: once per ability use by any unit, its first debuff on an enemy
  // grants Slashed Dream. The Crimson Knot goes to the enemy with the most
  // Knots among those the ability use debuffed, placed when it ends (or at
  // the next use, for debuffs after this kit's actionEnd listener).
  // Debuffs outside ability use (DoT-time Arcana) do not count.
  const abilityDebuff = (event: BattleEvent) =>
    event.abilityId !== undefined &&
    event.status?.debuff === true &&
    isEnemy(event.target);
  const placeKnot = (ctx: BattleApi, preferred?: UnitView) => {
    if (ctx.self.counter(KNOT_PENDING) <= 0) return;
    ctx.setCounter(ctx.self, KNOT_PENDING, 0);
    const use = ctx.self.counter(USE);
    const debuffed = ctx.enemies.filter(
      (enemy) => enemy.counter(DEBUFFED) === use
    );
    const first = debuffed.find((enemy) => enemy === preferred) ?? debuffed[0];
    if (!first) return;
    const target = debuffed.reduce(
      (best, enemy) => (enemy.stacks(knot) > best.stacks(knot) ? enemy : best),
      first
    );
    inflictKnots(ctx, target, 1);
  };
  k.on(
    "statusApplied",
    "talent",
    { subject: "any", when: abilityDebuff, limitPerAction: 1 },
    (ctx) => {
      placeKnot(ctx);
      ctx.setCounter(ctx.self, USE, ctx.self.counter(USE) + 1);
      gainDream(ctx, 1);
      // "Crimson Knot cannot be applied to enemies during the Ultimate."
      const blocked = ctx.self.counter(IN_ULTIMATE) > 0;
      ctx.setCounter(ctx.self, KNOT_PENDING, blocked ? 0 : 1);
    }
  );
  k.on(
    "statusApplied",
    "talent",
    { subject: "any", when: abilityDebuff },
    (ctx, event) => {
      if (isEnemy(event.target)) {
        ctx.setCounter(event.target, DEBUFFED, ctx.self.counter(USE));
      }
    }
  );
  k.on("actionEnd", "talent", { subject: "ally" }, (ctx, event) =>
    placeKnot(ctx, event.target)
  );

  if (k.a(1)) {
    // "A random enemy": the designated target, which the player then aims at.
    k.on("battleStart", "a2", { subject: "any" }, (ctx) => {
      gainDream(ctx, k.traceParam(1, 1));
      const target = mainTarget(ctx);
      if (target) inflictKnots(ctx, target, k.traceParam(1, 1));
    });
  }

  if (k.a(2)) {
    // E2 lowers only the requirement of the 160% tier, from 2 to 1.
    const others = Math.max(0, k.countPath("Warlock") - 1);
    const fullTier = k.e(2) ? 1 : 2;
    const ratio =
      others >= fullTier
        ? k.traceParam(2, 2)
        : others >= 1
          ? k.traceParam(2, 1)
          : 1;
    if (ratio > 1) {
      k.stat("a4", {
        stat: "dmgMultiplier",
        value: ratio - 1,
        filter: { tags: ["basic", "skill", "ultimate"] },
      });
    }
  }

  if (k.e(1)) {
    k.stat("e1", {
      stat: "critRate",
      value: k.rankParam(1, 1),
      filter: { minTargetDebuffs: 1 },
    });
  }

  if (k.e(2)) {
    k.on("turnStart", "e2", { subject: "self" }, (ctx) => {
      gainDream(ctx, 1);
      const target = mainTarget(ctx);
      if (target) inflictKnots(ctx, mostKnots(ctx, target), 1);
    });
  }

  if (k.e(4)) {
    const vulnerability = k.status({
      id: "e4-ultimate-vulnerability",
      origin: "e4",
      debuff: true,
      modifiers: [
        {
          stat: "vulnerability",
          value: k.rankParam(4, 1),
          filter: { tags: ["ultimate"] },
        },
      ],
    });
    k.on("battleStart", "e4", { subject: "any" }, (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, vulnerability);
    });
  }

  // E6: Basic ATK and Skill DMG also count as Ultimate DMG and reduce
  // Toughness regardless of Weakness Types.
  const asUltimate: Pick<HitDef, "tags" | "toughnessWithoutWeakness"> = k.e(6)
    ? { tags: ["ultimate"], toughnessWithoutWeakness: 1 }
    : {};
  if (k.e(6)) {
    k.stat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 1),
      filter: { tags: ["ultimate"] },
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    energy: 0,
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        toughness: { main: 10 },
        ...asUltimate,
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    energy: 0,
    before: (ctx) => {
      gainDream(ctx, k.param("02", 3));
      if (!isEnemy(ctx.target)) return;
      inflictKnots(ctx, ctx.target, k.param("02", 3));
    },
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
        ...asUltimate,
      },
    ],
  });

  // The Ultimate's Toughness lives on its hidden sub-skills (Skill31-34 in
  // AvatarSkillConfig): each Rainblade 5 to the target plus 5 to every enemy
  // for its Crimson Knot burst, and Stygian Resurge 5 to every enemy. The
  // Talent: "During the Ultimate, reduces enemies' Toughness regardless of
  // Weakness Types."
  const rainblade: HitDef = {
    shape: "single",
    main: k.param("03", 1),
    toughness: { main: 5 },
    toughnessWithoutWeakness: 1,
  };
  const resurge: HitDef = {
    shape: "single",
    main: k.param("03", 3),
    toughness: { main: 5 },
    toughnessWithoutWeakness: 1,
  };
  // #2 per removed stack on top of #2, capped at #5 (3 stacks).
  const burst = (removed: number): HitDef => ({
    shape: "single",
    main: Math.min(k.param("03", 5), k.param("03", 2) * (1 + removed)),
    toughness: { main: 5 },
    toughnessWithoutWeakness: 1,
  });
  const ultimateHit = (ctx: BattleApi, hit: HitDef, enemy: EnemyView) => {
    ctx.deal(hit, {
      targets: [enemy],
      tags: ["ultimate"],
      abilityKind: "ultimate",
      origin: "ultimate",
    });
  };
  const afterRainblade = (
    ctx: BattleApi,
    target: EnemyView,
    hadKnot: boolean
  ) => {
    if (k.a(3) && hadKnot) ctx.applyStatus(ctx.self, thunderCore);
    // "Removes up to 3 stacks of Crimson Knot."
    const removed = Math.min(3, target.stacks(knot));
    if (removed <= 0) return;
    ctx.consumeStacks(target, knot, removed);
    for (const enemy of ctx.enemies) ultimateHit(ctx, burst(removed), enemy);
  };

  let firstHadKnot = false;
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    energy: 0,
    resource: { counter: DREAM, amount: maxDream },
    before: (ctx) => {
      placeKnot(ctx);
      ctx.setCounter(ctx.self, IN_ULTIMATE, 1);
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, rainleaf);
      firstHadKnot = isEnemy(ctx.target) && ctx.target.has(knot);
    },
    // The first Rainblade; the rest of the sequence depends on Crimson Knot.
    hits: [rainblade],
    after: (ctx) => {
      const target = isEnemy(ctx.target) ? ctx.target : mainTarget(ctx);
      if (target) {
        afterRainblade(ctx, target, firstHadKnot);
        for (let index = 1; index < 3; index += 1) {
          const hadKnot = target.has(knot);
          ultimateHit(ctx, rainblade, target);
          afterRainblade(ctx, target, hadKnot);
        }
      }
      for (const enemy of ctx.enemies) ultimateHit(ctx, resurge, enemy);
      for (const enemy of ctx.enemies) ctx.removeStatus(enemy, knot);
      if (k.a(3)) {
        // Random targets as expected bounces.
        ctx.deal(
          {
            shape: "bounce",
            bounces: k.traceParam(3, 4),
            each: k.traceParam(3, 5),
          },
          {
            targets: ctx.enemies,
            tags: ["ultimate"],
            abilityKind: "ultimate",
            origin: "ultimate",
          }
        );
      }
      for (const enemy of ctx.enemies) ctx.removeStatus(enemy, rainleaf);
      ctx.setCounter(ctx.self, IN_ULTIMATE, 0);
      // Quadrivalent Ascendance: every stack is spent after the Ultimate.
      const stacks = ctx.self.stacks(quadrivalent);
      if (stacks > 0) {
        ctx.removeStatus(ctx.self, quadrivalent);
        gainDream(ctx, stacks * k.param("07", 2));
        const fallback = mainTarget(ctx);
        if (fallback) {
          inflictKnots(
            ctx,
            mostKnots(ctx, fallback),
            stacks * k.param("07", 2)
          );
        }
      }
    },
  });
});
