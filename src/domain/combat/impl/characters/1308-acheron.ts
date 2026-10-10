import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

const DREAM = "acheron:slashed-dream";
const ARMED = "acheron:talent-armed";
const IN_ULTIMATE = "acheron:in-ultimate";

/** Acheron — Nihility, Lightning. */
export default defineCharacter("1308", (k) => {
  // Slashed Dream is her Energy bar (max Energy 9 = Talent #1). The counter
  // is the source of truth; Energy mirrors it so that Energy from other
  // sources (enemy hits, ally effects) never fills it.
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
    ctx.setEnergy(ctx.self, kept);
    if (k.a(1) && total > kept) {
      ctx.applyStatus(ctx.self, quadrivalent, { stacks: total - kept });
    }
  };
  const resync = (ctx: BattleApi) =>
    ctx.setEnergy(ctx.self, ctx.self.counter(DREAM));
  k.on("hitByEnemy", "talent", { subject: "self" }, resync);
  k.on("actionEnd", "talent", { subject: "ally" }, resync);

  // Talent: the first debuff any ally inflicts while using an ability. The
  // window opens at each ally action and closes at enemy turns, so DoT-time
  // debuffs (Arcana at turn start) do not count. Crimson Knot goes to the
  // enemy with the most stacks; the Engine always aims at the designated
  // target, which is where stacks accumulate.
  k.on("actionStart", "talent", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, ARMED, 1)
  );
  k.on("turnStart", "talent", { subject: "enemy" }, (ctx) =>
    ctx.setCounter(ctx.self, ARMED, 0)
  );
  k.on("statusApplied", "talent", { subject: "ally" }, (ctx, event) => {
    if (!event.status?.debuff || !isEnemy(event.target)) return;
    if (ctx.self.counter(ARMED) <= 0) return;
    ctx.setCounter(ctx.self, ARMED, 0);
    gainDream(ctx, 1);
    inflictKnots(ctx, mostKnots(ctx, event.target), 1);
  });

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

  // E1 depends on the target's debuffs: synced to each enemy before it is hit.
  const e1Crit = k.status({
    id: "e1-crit",
    origin: "e1",
    modifiers: [{ stat: "critRate", value: k.rankParam(1, 1) }],
  });
  const aim = (ctx: BattleApi, enemy: EnemyView | null | undefined) => {
    if (!k.e(1)) return;
    if (enemy && enemy.debuffCount() > 0) {
      if (!ctx.self.has(e1Crit)) ctx.applyStatus(ctx.self, e1Crit);
    } else {
      ctx.removeStatus(ctx.self, e1Crit);
    }
  };

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

  // E6: Basic ATK and Skill DMG also count as Ultimate DMG.
  const asUltimate: Pick<HitDef, "tags"> = k.e(6) ? { tags: ["ultimate"] } : {};
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
    before: (ctx) => aim(ctx, isEnemy(ctx.target) ? ctx.target : null),
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
      aim(ctx, ctx.target);
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
  // for its Crimson Knot burst, and Stygian Resurge 5 to every enemy.
  const rainblade: HitDef = {
    shape: "single",
    main: k.param("03", 1),
    toughness: { main: 5 },
  };
  const resurge: HitDef = {
    shape: "single",
    main: k.param("03", 3),
    toughness: { main: 5 },
  };
  // #2 per removed stack on top of #2, capped at #5 (3 stacks).
  const burst = (removed: number): HitDef => ({
    shape: "single",
    main: Math.min(k.param("03", 5), k.param("03", 2) * (1 + removed)),
    toughness: { main: 5 },
  });
  const ultimateHit = (ctx: BattleApi, hit: HitDef, enemy: EnemyView) => {
    aim(ctx, enemy);
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
    before: (ctx) => {
      ctx.setCounter(ctx.self, DREAM, 0);
      resync(ctx);
      ctx.setCounter(ctx.self, IN_ULTIMATE, 1);
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, rainleaf);
      firstHadKnot = isEnemy(ctx.target) && ctx.target.has(knot);
      aim(ctx, isEnemy(ctx.target) ? ctx.target : null);
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
        // Random targets as expected bounces, grouped by E1's condition.
        const debuffed = ctx.enemies.filter((enemy) => enemy.debuffCount() > 0);
        const clean = ctx.enemies.filter((enemy) => enemy.debuffCount() === 0);
        for (const group of [debuffed, clean]) {
          if (group.length === 0) continue;
          aim(ctx, group[0]);
          ctx.deal(
            {
              shape: "bounce",
              bounces: (k.traceParam(3, 4) * group.length) / ctx.enemies.length,
              each: k.traceParam(3, 5),
            },
            {
              targets: group,
              tags: ["ultimate"],
              abilityKind: "ultimate",
              origin: "ultimate",
            }
          );
        }
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
