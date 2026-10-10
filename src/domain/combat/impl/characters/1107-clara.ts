import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Clara — Destruction, Physical. */
export default defineCharacter("1107", (k) => {
  // The engine spreads each enemy attack over allies by aggro, so a Mark of
  // Counter exists only with the probability that the enemy attacked Clara.
  // The per-enemy counter holds that probability, and the Skill's extra hit
  // scales by it (damage is linear in the multiplier).
  const MARK = "clara-mark-of-counter";
  // Enhanced Counters left, and whether the current enemy attack used one.
  const CHARGES = "enhanced-counters";
  const ENHANCED_NOW = "enhanced-counter-this-attack";

  const mark = (ctx: BattleApi, enemy: EnemyView, chance = 1) =>
    ctx.addCounter(enemy, MARK, chance * (1 - enemy.counter(MARK)), 1);

  if (k.a(3)) {
    // Svarog's Counters are Clara's only Follow-Up ATKs.
    k.stat("a6", {
      stat: "dmgBoost",
      value: k.traceParam(3, 1),
      filter: { tags: ["followUp"] },
    });
  }

  const e2Atk = k.status({
    id: "e2-atk",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "atkPct", value: k.rankParam(2, 1) }],
  });

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
    after: (ctx) => {
      for (const enemy of ctx.enemies) {
        const marked = enemy.counter(MARK);
        if (marked <= 0) continue;
        ctx.deal(
          { shape: "single", main: k.param("02", 2) * marked },
          {
            targets: [enemy],
            tags: ["skill"],
            abilityKind: "skill",
            origin: "skill",
          }
        );
        if (!k.e(1)) ctx.setCounter(enemy, MARK, 0);
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    // DMG reduction and the higher chance to be attacked (aggro) are not
    // modeled; see the tracker.
    after: (ctx) => {
      ctx.setCounter(
        ctx.self,
        CHARGES,
        k.param("03", 5) + (k.e(6) ? k.rankParam(6, 2) : 0)
      );
      if (k.e(2)) ctx.applyStatus(ctx.self, e2Atk);
    },
  });

  k.ability({
    id: "counter",
    kind: "followUp",
    energy: 5,
    hits: [
      { shape: "single", main: k.param("04", 2), toughness: { main: 10 } },
    ],
  });

  // "Enemies adjacent to it take 50% of the DMG dealt to the primary target"
  // (no parameter in the text).
  const enhancedMultiplier = k.param("04", 2) + k.param("03", 2);
  k.ability({
    id: "enhancedCounter",
    kind: "followUp",
    energy: 5,
    hits: [
      {
        shape: "blast",
        main: enhancedMultiplier,
        adjacent: enhancedMultiplier * 0.5,
        toughness: { main: 10, adjacent: 10 },
      },
    ],
  });

  // Enhanced Counters answer an attack on any ally; one Counter per attack.
  k.on("enemyAttack", "ultimate", { subject: "enemy" }, (ctx, event) => {
    const attacker = event.unit;
    const enhanced = isEnemy(attacker) && ctx.self.counter(CHARGES) >= 1;
    ctx.setCounter(ctx.self, ENHANCED_NOW, enhanced ? 1 : 0);
    if (!enhanced) return;
    ctx.addCounter(ctx.self, CHARGES, -1);
    ctx.queueAction(ctx.self, "enhancedCounter", { target: attacker });
  });

  k.on("hitByEnemy", "talent", { subject: "self" }, (ctx, event) => {
    const attacker = event.target;
    if (!isEnemy(attacker)) return;
    mark(ctx, attacker);
    if (ctx.self.counter(ENHANCED_NOW) >= 1) return;
    ctx.queueAction(ctx.self, "counter", { target: attacker });
  });

  if (k.e(6)) {
    const chance = k.rankParam(6, 1);
    k.on("hitByEnemy", "e6", { subject: "otherAlly" }, (ctx, event) => {
      const attacker = event.target;
      if (!isEnemy(attacker)) return;
      mark(ctx, attacker, chance);
      if (ctx.self.counter(ENHANCED_NOW) >= 1) return;
      ctx.queueAction(ctx.self, "counter", {
        target: attacker,
        weight: chance,
      });
    });
  }
});
