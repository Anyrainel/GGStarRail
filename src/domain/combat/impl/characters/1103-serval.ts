import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

const SHOCK_TURNS = "serval-shock-turns";

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
    origin: "skill",
    debuff: true,
    duration: { turns: shockTurns },
    dot: { hit: { shape: "single", main: k.param("02", 5), kind: "dot" } },
  });

  // "Shocked" is read from Serval's own Shock only: kits cannot see Shock
  // from other Characters or from Weakness Break (tracker serval-shock-sources).
  const isShocked = (ctx: BattleApi, enemy: EnemyView) =>
    enemy.has(shock, ctx.self);

  // The Ultimate extends remaining Shock turns, which the battle API does not
  // expose; a per-enemy counter mirrors the countdown at enemy turn ends
  // (tracker serval-shock-extend).
  const inflictShock = (ctx: BattleApi, enemy: EnemyView, chance: number) => {
    ctx.applyStatus(enemy, shock, { baseChance: chance });
    ctx.setCounter(enemy, SHOCK_TURNS, shockTurns);
  };
  k.on("turnEnd", "skill", { subject: "enemy" }, (ctx, event) => {
    const enemy = event.unit;
    if (!isEnemy(enemy) || !isShocked(ctx, enemy)) return;
    ctx.setCounter(
      enemy,
      SHOCK_TURNS,
      Math.max(0, enemy.counter(SHOCK_TURNS) - 1)
    );
  });

  // E6 boosts DMG against Shocked targets only. The boost is weighted by the
  // Shocked share of each attack's multipliers (tracker
  // serval-e6-shocked-share); her own Shock DoT always qualifies.
  const songRocks = k.status({
    id: "this-song-rocks",
    origin: "e6",
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(6, 1) }],
  });
  const applyShockedShare = (
    ctx: BattleApi,
    targets: readonly (readonly [EnemyView, number])[]
  ) => {
    if (!k.e(6)) return;
    let shocked = 0;
    let total = 0;
    for (const [enemy, multiplier] of targets) {
      total += multiplier;
      if (isShocked(ctx, enemy)) shocked += multiplier;
    }
    if (shocked > 0) {
      ctx.applyStatus(ctx.self, songRocks, { setStacks: shocked / total });
    } else {
      ctx.removeStatus(ctx.self, songRocks);
    }
  };
  if (k.e(6)) {
    k.stat("e6", {
      stat: "dmgBoost",
      value: k.rankParam(6, 1),
      filter: { tags: ["dot"] },
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
    before: (ctx) => {
      if (isEnemy(ctx.target)) applyShockedShare(ctx, [[ctx.target, 1]]);
    },
    after: (ctx) => {
      if (k.e(1) && isEnemy(ctx.target)) {
        // "60% of Basic ATK DMG to a random adjacent target": a share of the
        // multiplier; its Toughness is not in the facts.
        const adjacent = adjacentTo(ctx.enemies, ctx.target);
        if (adjacent.length > 0) {
          applyShockedShare(
            ctx,
            adjacent.map((enemy) => [enemy, 1] as const)
          );
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
      ctx.removeStatus(ctx.self, songRocks);
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
    before: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      applyShockedShare(
        ctx,
        blastTargets(ctx.enemies, ctx.target).map(
          (enemy) =>
            [enemy, enemy === ctx.target ? skillMain : skillAdjacent] as const
        )
      );
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, songRocks);
      if (!isEnemy(ctx.target)) return;
      for (const enemy of blastTargets(ctx.enemies, ctx.target)) {
        inflictShock(ctx, enemy, skillShockChance);
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    before: (ctx) =>
      applyShockedShare(
        ctx,
        ctx.enemies.map((enemy) => [enemy, 1] as const)
      ),
    after: (ctx) => {
      ctx.removeStatus(ctx.self, songRocks);
      for (const enemy of ctx.enemies) {
        if (isShocked(ctx, enemy)) {
          // Re-applying keeps the landing chance (the highest one applies).
          const turns = enemy.counter(SHOCK_TURNS) + k.param("03", 2);
          ctx.applyStatus(enemy, shock, {
            baseChance: skillShockChance,
            turns,
          });
          ctx.setCounter(enemy, SHOCK_TURNS, turns);
        } else if (k.e(4)) {
          inflictShock(ctx, enemy, k.rankParam(4, 1));
        }
      }
    },
  });

  k.on("actionEnd", "talent", { attack: true }, (ctx) => {
    const shocked = ctx.enemies.filter((enemy) => isShocked(ctx, enemy));
    if (shocked.length === 0) return;
    if (k.e(6)) ctx.applyStatus(ctx.self, songRocks);
    ctx.deal(
      { shape: "aoe", each: k.param("04", 1), onlyTags: ["additional"] },
      { targets: shocked, origin: "talent" }
    );
    ctx.removeStatus(ctx.self, songRocks);
    // Read as once per Talent trigger, not per enemy (tracker serval-e2-energy).
    if (k.e(2)) ctx.gainEnergy(ctx.self, k.rankParam(2, 1));
  });
});
