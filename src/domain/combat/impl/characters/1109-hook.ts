import {
  type ActionContext,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
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

  // E1 and E6 only cover some hits of an action, so these statuses exist
  // only while the matching damage is dealt.
  const e1Boost = k.status({
    id: "e1-enhanced-skill",
    origin: "e1",
    modifiers: k.e(1) ? [{ stat: "dmgBoost", value: k.rankParam(1, 1) }] : [],
  });
  const e6Boost = k.status({
    id: "e6-burned-target",
    origin: "e6",
    modifiers: k.e(6) ? [{ stat: "dmgBoost", value: k.rankParam(6, 1) }] : [],
  });
  if (k.e(6)) {
    // Hook's only DoT is her Burn, which always sits on a Burned enemy.
    k.stat("e6", {
      stat: "dmgBoost",
      value: k.rankParam(6, 1),
      filter: { tags: ["dot"] },
    });
  }

  // Only Hook's own Burn is visible to the kit: Burn from Weakness Break or
  // other Characters does not arm the Talent or E6 (tracked engine gap).
  const burned = (target: UnitView | null | undefined): target is EnemyView =>
    isEnemy(target) && target.has(burn);

  const adjacentTo = (ctx: ActionContext, target: EnemyView): EnemyView[] => {
    const index = ctx.enemies.indexOf(target);
    return [ctx.enemies[index - 1], ctx.enemies[index + 1]].filter(
      (enemy): enemy is EnemyView => enemy !== undefined
    );
  };

  // "When attacking a target afflicted with Burn": checked before the attack
  // lands, on the designated target. E4 spreads Burn around "the designated
  // enemy target", so the Talent is read as one trigger per attack.
  const ARMED = "talent-armed";
  const armTalent = (ctx: ActionContext) => {
    const armed = burned(ctx.target);
    ctx.setCounter(ctx.self, ARMED, armed ? 1 : 0);
    if (k.e(6) && armed) ctx.applyStatus(ctx.self, e6Boost);
  };
  const resolveTalent = (ctx: ActionContext) => {
    ctx.removeStatus(ctx.self, e6Boost);
    const target = ctx.target;
    if (ctx.self.counter(ARMED) < 1 || !isEnemy(target)) return;
    ctx.setCounter(ctx.self, ARMED, 0);
    if (k.e(6)) ctx.applyStatus(ctx.self, e6Boost);
    ctx.deal(
      { shape: "single", main: k.param("04", 1), onlyTags: ["additional"] },
      { targets: [target], origin: "talent" }
    );
    ctx.removeStatus(ctx.self, e6Boost);
    ctx.gainEnergy(ctx.self, k.param("04", 2));
    if (k.e(4)) {
      for (const enemy of adjacentTo(ctx, target)) {
        ctx.applyStatus(enemy, burn, { baseChance: k.rankParam(4, 1) });
      }
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    before: armTalent,
    after: resolveTalent,
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    before: armTalent,
    after: (ctx) => {
      if (isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, burn, { baseChance: k.param("02", 2) });
      }
      resolveTalent(ctx);
    },
  });

  k.ability({
    id: "enhancedSkill",
    kind: "skill",
    hits: [
      { shape: "single", main: k.param("09", 1), toughness: { main: 20 } },
    ],
    before: (ctx) => {
      ctx.removeStatus(ctx.self, enhancedReady);
      if (k.e(1)) ctx.applyStatus(ctx.self, e1Boost);
      armTalent(ctx);
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, e6Boost);
      const target = ctx.target;
      if (isEnemy(target)) {
        // Adjacent hits are dealt one by one so E6 follows each one's Burn.
        for (const enemy of adjacentTo(ctx, target)) {
          const bonus = k.e(6) && burned(enemy);
          if (bonus) ctx.applyStatus(ctx.self, e6Boost);
          ctx.deal(
            {
              shape: "single",
              main: k.param("09", 5),
              toughness: { main: 10 },
            },
            {
              targets: [enemy],
              tags: ["skill"],
              abilityKind: "skill",
              origin: "skill",
            }
          );
          if (bonus) ctx.removeStatus(ctx.self, e6Boost);
        }
        ctx.applyStatus(target, burn, { baseChance: k.param("09", 2) });
      }
      ctx.removeStatus(ctx.self, e1Boost);
      resolveTalent(ctx);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    before: armTalent,
    after: (ctx) => {
      resolveTalent(ctx);
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
