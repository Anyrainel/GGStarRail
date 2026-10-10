import { type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

function blastTargets(
  enemies: readonly EnemyView[],
  main: EnemyView
): EnemyView[] {
  const index = enemies.indexOf(main);
  return [enemies[index - 1], main, enemies[index + 1]].filter(isEnemy);
}

function adjacentTo(
  enemies: readonly EnemyView[],
  main: EnemyView
): EnemyView[] {
  const index = enemies.indexOf(main);
  return [enemies[index - 1], enemies[index + 1]].filter(isEnemy);
}

/** Serval — Erudition, Lightning. */
export default defineCharacter("1103", (k) => {
  const shockTurns = k.param("02", 4);
  const skillShockChance = k.param("02", 3) + (k.a(1) ? k.traceParam(1, 1) : 0);
  const shock = k.status({
    id: "shock",
    family: "shock",
    origin: "skill",
    debuff: true,
    duration: { turns: shockTurns },
    dot: { hit: { shape: "single", main: k.param("02", 5), kind: "dot" } },
  });

  if (k.e(6)) {
    k.stat("e6", {
      stat: "dmgBoost",
      value: k.rankParam(6, 1),
      filter: { targetFamilies: ["shock"] },
    });
  }

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(2, 1))
    );
  }

  // A6 needs a kill (engine-kill-triggers); while on, it is held throughout.
  if (k.a(3) && k.toggle("a6-mania", "a6", "active", false)) {
    k.stat("a6", { stat: "atkPct", value: k.traceParam(3, 1) });
  }

  const basicMultiplier = k.param("01", 1);
  k.ability({
    id: "basic",
    kind: "basic",
    hits: [{ shape: "single", main: basicMultiplier, toughness: { main: 10 } }],
    after: (ctx) => {
      if (k.e(1) && isEnemy(ctx.target)) {
        // "60% of Basic ATK DMG to a random adjacent target": a share of the
        // multiplier; its Toughness is not in the facts.
        const adjacent = adjacentTo(ctx.enemies, ctx.target);
        if (adjacent.length > 0) {
          ctx.deal(
            {
              shape: "bounce",
              each: k.rankParam(1, 1) * basicMultiplier,
              bounces: 1,
            },
            {
              targets: adjacent,
              tags: ["basic"],
              abilityKind: "basic",
              origin: "e1",
            }
          );
        }
      }
    },
  });

  const skillMain = k.param("02", 1);
  const skillAdjacent = k.param("02", 2);
  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      {
        shape: "blast",
        main: skillMain,
        adjacent: skillAdjacent,
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      for (const enemy of blastTargets(ctx.enemies, ctx.target)) {
        ctx.applyStatus(enemy, shock, { baseChance: skillShockChance });
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      for (const enemy of ctx.enemies) {
        if (enemy.has(shock, ctx.self)) {
          ctx.extendStatus(enemy, shock, k.param("03", 2));
        } else if (k.e(4)) {
          // "not currently Shocked" is read against Serval's own Shock, the
          // one the Ultimate extends.
          ctx.applyStatus(enemy, shock, { baseChance: k.rankParam(4, 1) });
        }
      }
    },
  });

  k.on("actionEnd", "talent", { attack: true }, (ctx) => {
    const shocked = ctx.enemies.filter((enemy) => enemy.hasFamily("shock"));
    if (shocked.length === 0) return;
    ctx.deal(
      { shape: "aoe", each: k.param("04", 1), onlyTags: ["additional"] },
      { targets: shocked, origin: "talent" }
    );
    // Read as once per Talent trigger, not per enemy (tracker serval-e2-energy).
    if (k.e(2)) ctx.gainEnergy(ctx.self, k.rankParam(2, 1));
  });
});
