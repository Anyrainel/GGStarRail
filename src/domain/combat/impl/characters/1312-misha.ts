import { BREAK_EFFECT_STATUS } from "../../battle/breakEffects";
import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Misha — Destruction, Ice. */
export default defineCharacter("1312", (k) => {
  const perHit = k.param("03", 2) + (k.e(4) ? k.rankParam(4, 1) : 0);
  const defaultHits = k.param("03", 1);
  const maxHits = k.param("03", 5);
  const freezeChance = k.param("03", 3);

  // Stacks hold the expected chance that this Freeze is active: the engine
  // has no landing chance for non-DoT turn-start damage or "vs Frozen"
  // filters, so both read this probability (see tracker misha-freeze-chance).
  const freeze = k.status({
    id: "freeze",
    origin: "ultimate",
    debuff: true,
    duration: { turns: 1 },
    maxStacks: 1,
  });

  // A6 needs a "target is Frozen" filter; stacks = chance the target is Frozen.
  const frozenCrit = k.status({
    id: "a6-frozen-crit-dmg",
    origin: "a6",
    maxStacks: 1,
    modifiers: [{ stat: "critDmg", value: k.a(3) ? k.traceParam(3, 1) : 0 }],
  });

  const defShred = k.status({
    id: "e2-def-reduction",
    origin: "e2",
    debuff: true,
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "defReduction", value: k.rankParam(2, 1) }],
  });

  const e6Boost = k.status({
    id: "e6-dmg",
    origin: "e6",
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(6, 2) }],
  });

  // A4 lasts only for the Ultimate's action, and the Ultimate applies all of
  // Misha's debuffs; the engine reads panel Effect Hit Rate for landing.
  if (k.a(2))
    k.stat("a4", { stat: "effectHitRate", value: k.traceParam(2, 1) });

  /** Chance the enemy is Frozen (Misha's Freeze or an Ice Weakness Break). */
  const frozenChance = (ctx: BattleApi, enemy: EnemyView): number => {
    const broken = enemy.has(BREAK_EFFECT_STATUS.frozen) ? 1 : 0;
    const own = enemy.stacks(freeze, ctx.self);
    return 1 - (1 - broken) * (1 - own);
  };

  const setFrozenCrit = (ctx: BattleApi, chance: number) => {
    if (!k.a(3)) return;
    if (chance > 0)
      ctx.applyStatus(ctx.self, frozenCrit, { setStacks: chance });
    else ctx.removeStatus(ctx.self, frozenCrit);
  };

  /**
   * One Ultimate hit's Freeze attempt on `enemy`, which this hit targets
   * with probability `share`. Landing uses the base chance: A4's +60% Effect
   * Hit Rate roughly offsets typical Effect RES (1.6 × 0.65 ≈ 1).
   * Returns the chance the enemy is Frozen when this hit lands on it.
   */
  const attemptFreeze = (
    ctx: BattleApi,
    enemy: EnemyView,
    base: number,
    share: number
  ): number => {
    const chance = Math.min(1, base);
    const before = enemy.stacks(freeze, ctx.self);
    const after = 1 - (1 - before) * (1 - share * chance);
    ctx.applyStatus(enemy, freeze, { setStacks: after });
    const broken = enemy.has(BREAK_EFFECT_STATUS.frozen) ? 1 : 0;
    return 1 - (1 - broken) * (1 - before) * (1 - chance);
  };

  /**
   * E2 attempt on `enemy` (targeted with probability `share`). Repeated
   * attempts combine into one base chance, re-applied as a fresh instance
   * because the engine caches a status's chance until its stacks change.
   */
  const attemptShred = (ctx: BattleApi, enemy: EnemyView, share: number) => {
    const prior = enemy.has(defShred, ctx.self)
      ? enemy.counter("1312:e2-chance")
      : 0;
    const chance = 1 - (1 - prior) * (1 - share * k.rankParam(2, 3));
    ctx.setCounter(enemy, "1312:e2-chance", chance);
    ctx.removeStatus(enemy, defShred);
    ctx.applyStatus(enemy, defShred, { baseChance: chance });
  };

  /** Accumulated hits beyond the default, capped at the Ultimate's maximum. */
  const addHits = (ctx: BattleApi, amount: number) => {
    const next = ctx.self.counter("extra-hits") + amount;
    ctx.setCounter(
      ctx.self,
      "extra-hits",
      Math.min(maxHits - defaultHits, next)
    );
  };

  const withFrozenCrit = (ctx: ActionContext) => {
    if (isEnemy(ctx.target)) setFrozenCrit(ctx, frozenChance(ctx, ctx.target));
  };

  k.ability({
    id: "basic",
    kind: "basic",
    before: withFrozenCrit,
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => setFrozenCrit(ctx, 0),
  });

  k.ability({
    id: "skill",
    kind: "skill",
    // A6 for the adjacent targets uses the main target's Frozen chance.
    before: withFrozenCrit,
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      setFrozenCrit(ctx, 0);
      addHits(ctx, k.param("02", 3));
      if (k.e(6) && ctx.self.counter("e6-skill-point") > 0) {
        ctx.setCounter(ctx.self, "e6-skill-point", 0);
        ctx.gainSkillPoints(k.rankParam(6, 1));
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      // E1 adds hits to this Ultimate after the accumulation cap (ZH 本次终结技
      // ...额外增加 vs 最多累计): see tracker misha-e1-hit-cap.
      const e1 = k.e(1)
        ? Math.min(k.rankParam(1, 2), ctx.enemies.length * k.rankParam(1, 1))
        : 0;
      const total = defaultHits + ctx.self.counter("extra-hits") + e1;
      ctx.setCounter(ctx.self, "ult-hits", total);
      ctx.setCounter(ctx.self, "extra-hits", 0);
      if (k.e(6)) {
        ctx.applyStatus(ctx.self, e6Boost);
        ctx.setCounter(ctx.self, "e6-skill-point", 1);
      }
      if (!isEnemy(ctx.target)) return;
      const firstChance = freezeChance + (k.a(1) ? k.traceParam(1, 1) : 0);
      setFrozenCrit(ctx, attemptFreeze(ctx, ctx.target, firstChance, 1));
      if (k.e(2)) attemptShred(ctx, ctx.target, 1);
    },
    hits: [{ shape: "single", main: perHit, toughness: { main: 10 } }],
    after: (ctx) => {
      // Remaining hits target random enemies: each hit is split across the
      // enemies (expected distribution) so Freeze and A6 stay per target.
      const remaining = ctx.self.counter("ult-hits") - 1;
      for (let index = 0; index < remaining; index += 1) {
        const weight = Math.min(1, remaining - index);
        const share = weight / ctx.enemies.length;
        for (const enemy of ctx.enemies) {
          setFrozenCrit(ctx, attemptFreeze(ctx, enemy, freezeChance, share));
          if (k.e(2)) attemptShred(ctx, enemy, share);
          ctx.deal(
            {
              shape: "bounce",
              each: perHit,
              bounces: share,
              toughness: { each: 10 },
            },
            {
              targets: [enemy],
              tags: ["ultimate"],
              abilityKind: "ultimate",
              origin: "ultimate",
            }
          );
        }
      }
      setFrozenCrit(ctx, 0);
      ctx.setCounter(ctx.self, "ult-hits", 0);
    },
  });

  // Frozen: Ice Additional DMG at the start of the enemy's turn. The engine
  // does not skip the turn of a kit-applied Freeze (tracker misha-freeze-skip).
  k.on("turnStart", "ultimate", { subject: "enemy" }, (ctx, event) => {
    const enemy = event.unit;
    if (!isEnemy(enemy)) return;
    const chance = enemy.stacks(freeze, ctx.self);
    if (chance <= 0) return;
    setFrozenCrit(ctx, 1);
    ctx.deal(
      {
        shape: "single",
        main: k.param("03", 4) * chance,
        onlyTags: ["additional"],
      },
      { targets: [enemy], origin: "ultimate" }
    );
    setFrozenCrit(ctx, 0);
  });

  if (k.e(6)) {
    k.on("turnEnd", "e6", {}, (ctx) => ctx.removeStatus(ctx.self, e6Boost));
  }

  // Talent: Skill Points consumed by any ally, read from the team's SP total
  // (no consumption event exists; see tracker misha-sp-tracking).
  k.on("battleStart", "talent", { subject: "any" }, (ctx) =>
    ctx.setCounter(ctx.self, "sp-seen", ctx.skillPoints)
  );
  k.on("actionStart", "talent", { subject: "ally" }, (ctx) => {
    const consumed = ctx.self.counter("sp-seen") - ctx.skillPoints;
    ctx.setCounter(ctx.self, "sp-seen", ctx.skillPoints);
    if (consumed <= 1e-9) return;
    addHits(ctx, consumed * k.param("04", 2));
    // gainEnergy scales by the action's weight; `consumed` already does.
    ctx.gainEnergy(ctx.self, (consumed * k.param("04", 1)) / ctx.weight);
  });
  const syncSkillPoints = (ctx: BattleApi) =>
    ctx.setCounter(ctx.self, "sp-seen", ctx.skillPoints);
  k.on("actionEnd", "talent", { subject: "ally" }, syncSkillPoints);
  k.on("turnStart", "talent", { subject: "any" }, syncSkillPoints);
});
