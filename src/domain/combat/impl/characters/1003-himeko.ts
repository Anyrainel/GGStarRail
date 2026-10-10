import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

const CHARGE = "victory-rush-charge";

function blastTargets(
  enemies: readonly EnemyView[],
  main: EnemyView
): EnemyView[] {
  const index = enemies.indexOf(main);
  return [enemies[index - 1], main, enemies[index + 1]].filter(isEnemy);
}

/** Himeko — Erudition, Fire. */
export default defineCharacter("1003", (k) => {
  const maxCharge = k.param("04", 2);

  const burn = k.status({
    id: "burn",
    origin: "a2",
    debuff: true,
    duration: { turns: k.traceParam(1, 2) },
    dot: { hit: { shape: "single", main: k.traceParam(1, 3), kind: "dot" } },
  });
  const inflictBurn = (ctx: BattleApi, targets: readonly EnemyView[]) => {
    if (!k.a(1)) return;
    for (const target of targets) {
      ctx.applyStatus(target, burn, { baseChance: k.traceParam(1, 1) });
    }
  };

  // A4 only boosts Skill DMG against Burned targets. Without a target-status
  // filter, the boost is weighted by the Burned share of the Skill's
  // multipliers (tracker himeko-a4-burned-share).
  const magma = k.status({
    id: "magma",
    origin: "a4",
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.traceParam(2, 1),
        filter: { tags: ["skill"] },
      },
    ],
  });

  const childhood = k.status({
    id: "childhood",
    origin: "e1",
    duration: { turns: k.rankParam(1, 2) },
    modifiers: [{ stat: "spdPct", value: k.rankParam(1, 1) }],
  });

  if (k.a(3)) {
    const highHp = k.toggle(
      "a6-high-hp",
      "a6",
      "selfHpAbove",
      true,
      k.traceParam(3, 1)
    );
    if (highHp) k.stat("a6", { stat: "critRate", value: k.traceParam(3, 2) });
  }

  if (k.e(2)) {
    const lowHp = k.toggle(
      "e2-low-hp",
      "e2",
      "enemyHpBelow",
      true,
      k.rankParam(2, 1)
    );
    if (lowHp) k.stat("e2", { stat: "dmgBoost", value: k.rankParam(2, 2) });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) inflictBurn(ctx, [ctx.target]);
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
      if (!k.a(2) || !isEnemy(ctx.target)) return;
      let burned = 0;
      let total = 0;
      for (const enemy of blastTargets(ctx.enemies, ctx.target)) {
        const multiplier = enemy === ctx.target ? skillMain : skillAdjacent;
        total += multiplier;
        if (enemy.has(burn)) burned += multiplier;
      }
      if (burned > 0) {
        ctx.applyStatus(ctx.self, magma, { setStacks: burned / total });
      }
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, magma);
      if (isEnemy(ctx.target)) {
        inflictBurn(ctx, blastTargets(ctx.enemies, ctx.target));
      }
    },
  });

  // The extra Energy per enemy defeated needs kills (engine-kill-triggers).
  const ultimateMultiplier = k.param("03", 1);
  const ultimateHits: HitDef[] = [
    { shape: "aoe", each: ultimateMultiplier, toughness: { each: 20 } },
  ];
  if (k.e(6)) {
    // "2 extra instances ... equal to 40% of the original DMG to one random
    // enemy": a share of the multiplier; their Toughness is not in the facts.
    const extra: HitDef = {
      shape: "bounce",
      each: k.rankParam(6, 1) * ultimateMultiplier,
      bounces: 1,
    };
    ultimateHits.push(extra, extra);
  }
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: ultimateHits,
    after: (ctx) => inflictBurn(ctx, ctx.enemies),
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 10,
    hits: [{ shape: "aoe", each: k.param("04", 1), toughness: { each: 10 } }],
    after: (ctx) => {
      inflictBurn(ctx, ctx.enemies);
      if (k.e(1)) ctx.applyStatus(ctx.self, childhood);
    },
  });

  k.on("battleStart", "talent", { subject: "any" }, (ctx) =>
    ctx.addCounter(ctx.self, CHARGE, 1, maxCharge)
  );
  k.on("weaknessBreak", "talent", { subject: "ally" }, (ctx) =>
    ctx.addCounter(ctx.self, CHARGE, 1, maxCharge)
  );
  if (k.e(4)) {
    k.on("weaknessBreak", "e4", { abilityKinds: ["skill"] }, (ctx) =>
      ctx.addCounter(ctx.self, CHARGE, k.rankParam(4, 1), maxCharge)
    );
  }
  k.on("actionEnd", "talent", { subject: "ally", attack: true }, (ctx) => {
    if (ctx.self.counter(CHARGE) < maxCharge) return;
    ctx.setCounter(ctx.self, CHARGE, 0);
    ctx.queueAction(ctx.self, "followUp");
  });
});
