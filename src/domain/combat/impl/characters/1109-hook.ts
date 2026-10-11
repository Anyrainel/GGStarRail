import { type ActionContext, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Hook — Destruction, Fire. */
export default defineCharacter("1109", (k) => {
  // "Burn caused by Skill"; E4 applies the same Burn, so E2 extends both.
  const burn = k.status({
    id: "burn",
    family: "burn",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 3) + (k.e(2) ? k.rankParam(2, 1) : 0) },
    dot: { hit: { shape: "single", main: k.param("02", 4), kind: "dot" } },
  });

  const enhancedReady = k.status({ id: "enhanced-skill", origin: "ultimate" });

  // E1 covers the whole Enhanced Skill, so it exists only during that action.
  const e1Boost = k.status({
    id: "e1-enhanced-skill",
    origin: "e1",
    modifiers: k.e(1) ? [{ stat: "dmgBoost", value: k.rankParam(1, 1) }] : [],
  });
  if (k.e(6)) {
    // Any Burn, from any source (Fire Weakness Break included).
    k.stat("e6", {
      stat: "dmgBoost",
      value: k.rankParam(6, 1),
      filter: { targetFamilies: ["burn"] },
    });
  }

  const burned = (enemy: EnemyView) => enemy.hasFamily("burn");

  const adjacentTo = (ctx: ActionContext, target: EnemyView): EnemyView[] => {
    const index = ctx.enemies.indexOf(target);
    return [ctx.enemies[index - 1], ctx.enemies[index + 1]].filter(
      (enemy): enemy is EnemyView => enemy !== undefined
    );
  };

  /**
   * Talent, once per attack after its hits land (ability config): checked on
   * the designated target, or for the Enhanced Skill on one random Burned
   * enemy among those it hit. Additional DMG and E4 follow each candidate
   * with its chance; Energy and A2's heal come once.
   */
  const resolveTalent = (ctx: ActionContext, candidates: EnemyView[]) => {
    const chosen = candidates.filter(burned);
    if (chosen.length === 0) return;
    const share = 1 / chosen.length;
    const e4Chance = new Map<EnemyView, number>();
    for (const enemy of chosen) {
      ctx.deal(
        { shape: "single", main: k.param("04", 1), onlyTags: ["additional"] },
        { targets: [enemy], origin: "talent", weight: share }
      );
      if (!k.e(4)) continue;
      for (const neighbour of adjacentTo(ctx, enemy)) {
        e4Chance.set(neighbour, (e4Chance.get(neighbour) ?? 0) + share);
      }
    }
    ctx.gainEnergy(ctx.self, k.param("04", 2));
    if (k.a(1)) {
      const boost = 1 + ctx.self.currentStat("outgoingHealing");
      ctx.heal(ctx.self, k.traceParam(1, 1) * boost);
    }
    for (const [enemy, chance] of e4Chance) {
      ctx.applyStatus(enemy, burn, {
        baseChance: k.rankParam(4, 1) * Math.min(1, chance),
      });
    }
  };
  const designated = (ctx: ActionContext): EnemyView[] =>
    isEnemy(ctx.target) ? [ctx.target] : [];

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => resolveTalent(ctx, designated(ctx)),
  });

  // The Skill's own Burn lands after the Talent's check.
  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      resolveTalent(ctx, designated(ctx));
      if (isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, burn, { baseChance: k.param("02", 2) });
      }
    },
  });

  k.ability({
    id: "enhancedSkill",
    kind: "skill",
    hits: [
      {
        shape: "blast",
        main: k.param("09", 1),
        adjacent: k.param("09", 5),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    before: (ctx) => {
      ctx.removeStatus(ctx.self, enhancedReady);
      if (k.e(1)) ctx.applyStatus(ctx.self, e1Boost);
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, e1Boost);
      resolveTalent(ctx, [...ctx.targetsHit()]);
      if (isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, burn, { baseChance: k.param("09", 2) });
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => {
      resolveTalent(ctx, designated(ctx));
      ctx.applyStatus(ctx.self, enhancedReady);
      if (k.a(3)) {
        ctx.advanceAction(ctx.self, k.traceParam(3, 2));
        ctx.gainEnergy(ctx.self, k.traceParam(3, 1));
      }
    },
  });

  // Skill (Enhanced after an Ultimate) whenever a Skill Point is available.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      return view.self.has(enhancedReady) ? "enhancedSkill" : "skill";
    },
  });
});
