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
    family: "burn",
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

  if (k.a(2)) {
    k.stat("a4", {
      stat: "dmgBoost",
      value: k.traceParam(2, 1),
      filter: { tags: ["skill"], targetFamilies: ["burn"] },
    });
  }

  const childhood = k.status({
    id: "childhood",
    origin: "e1",
    duration: { turns: k.rankParam(1, 2) },
    modifiers: [{ stat: "spdPct", value: k.rankParam(1, 1) }],
  });

  if (k.a(3)) {
    const benchmark = k.status({
      id: "benchmark",
      origin: "a6",
      modifiers: [{ stat: "critRate", value: k.traceParam(3, 2) }],
    });
    const threshold = k.traceParam(3, 1);
    const syncBenchmark = (ctx: BattleApi) => {
      const high = ctx.self.hpRatio >= threshold - 1e-9;
      if (high && !ctx.self.has(benchmark)) {
        ctx.applyStatus(ctx.self, benchmark);
      } else if (!high && ctx.self.has(benchmark)) {
        ctx.removeStatus(ctx.self, benchmark);
      }
    };
    k.on("battleStart", "a6", { subject: "any" }, syncBenchmark);
    k.on("hpChanged", "a6", {}, syncBenchmark);
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

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
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
    // 4 instances at 20/20/20/40% of the multiplier (fribbels' Ashblazing
    // split); the 10 Toughness per enemy is assumed to split the same way.
    hits: [0.2, 0.2, 0.2, 0.4].map(
      (share): HitDef => ({
        shape: "aoe",
        each: share * k.param("04", 1),
        toughness: { each: share * 10 },
      })
    ),
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
