import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { CombatType } from "../../model/stats";

const COMBAT_TYPES: readonly CombatType[] = [
  "Physical",
  "Fire",
  "Ice",
  "Thunder",
  "Wind",
  "Quantum",
  "Imaginary",
];

function weaknessBits(enemy: EnemyView): number {
  return COMBAT_TYPES.reduce(
    (bits, type, index) =>
      enemy.weaknesses.has(type) ? bits | (1 << index) : bits,
    0
  );
}

/**
 * Life Should Be Cast to Flames — Erudition. #1 is not referenced by the
 * text.
 */
export default defineLightCone("23041", (k) => {
  k.on("turnStart", "lightCone", {}, (ctx) => ctx.gainEnergy(ctx.self, k.s(5)));

  // Implants do not record who added them: Weaknesses that appear on an
  // enemy during the wearer's own actions are read as the wearer's and mark
  // the enemy until they are gone. Counters live on the enemy, keyed by the
  // wearer. Tracker: life-should-be-cast-to-flames-implanter.
  const implanted = k.status({
    id: "life-should-be-cast-to-flames-implant",
    origin: "lightCone",
  });
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(3),
    filter: { targetStatuses: [implanted.id] },
  });
  const beforeKey = (ctx: BattleApi) => `lc23041:${ctx.self.id}:before`;
  const ownKey = (ctx: BattleApi) => `lc23041:${ctx.self.id}:implanted`;
  const detect = (ctx: BattleApi, enemy: EnemyView) => {
    const added = weaknessBits(enemy) & ~enemy.counter(beforeKey(ctx));
    if (added === 0) return;
    ctx.setCounter(enemy, ownKey(ctx), enemy.counter(ownKey(ctx)) | added);
    ctx.setCounter(enemy, beforeKey(ctx), weaknessBits(enemy));
    ctx.applyStatus(enemy, implanted);
  };
  k.on("actionStart", "lightCone", {}, (ctx) => {
    for (const enemy of ctx.enemies) {
      const current = weaknessBits(enemy);
      const own = enemy.counter(ownKey(ctx)) & current;
      ctx.setCounter(enemy, ownKey(ctx), own);
      if (own === 0 && enemy.has(implanted)) {
        ctx.removeStatus(enemy, implanted);
      }
      ctx.setCounter(enemy, beforeKey(ctx), current);
    }
  });
  // Character listeners run first, so an implant made on a hit is seen by
  // that hit's event and boosts the following hits.
  k.on("hit", "lightCone", {}, (ctx, event) => {
    if (isEnemy(event.target)) detect(ctx, event.target);
  });
  k.on("actionEnd", "lightCone", {}, (ctx) => {
    for (const enemy of ctx.enemies) detect(ctx, enemy);
  });

  const smelt = k.status({
    id: "life-should-be-cast-to-flames-def",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "defReduction", value: k.s(2) }],
  });
  // "When attacked": the designated target from the start of the attack,
  // every other enemy once a hit lands on it. Tracker:
  // life-should-be-cast-to-flames-def-timing.
  k.on("actionStart", "lightCone", { attack: true }, (ctx, event) => {
    if (isEnemy(event.target)) ctx.applyStatus(event.target, smelt);
  });
  k.on("hit", "lightCone", {}, (ctx, event) => {
    if (isEnemy(event.target)) ctx.applyStatus(event.target, smelt);
  });
});
