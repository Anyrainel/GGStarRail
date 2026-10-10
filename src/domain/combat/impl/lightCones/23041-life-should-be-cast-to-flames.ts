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

  // Enemies holding a Weakness the wearer implanted carry a marker, with the
  // implanted Combat Types in a counter keyed by the wearer. Implants that
  // expired or were removed are dropped before each of the wearer's actions.
  const implanted = k.status({
    id: "life-should-be-cast-to-flames-implant",
    origin: "lightCone",
  });
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(3),
    filter: { targetStatuses: [implanted.id] },
  });
  const ownKey = (ctx: BattleApi) => `lc23041:${ctx.self.id}:implanted`;
  k.on("weaknessImplanted", "lightCone", {}, (ctx, event) => {
    const enemy = event.target;
    const index = event.combatType
      ? COMBAT_TYPES.indexOf(event.combatType)
      : -1;
    if (!isEnemy(enemy) || index < 0) return;
    ctx.setCounter(
      enemy,
      ownKey(ctx),
      enemy.counter(ownKey(ctx)) | (1 << index)
    );
    ctx.applyStatus(enemy, implanted);
  });
  k.on("actionStart", "lightCone", {}, (ctx) => {
    for (const enemy of ctx.enemies) {
      if (!enemy.has(implanted, ctx.self)) continue;
      const own = enemy.counter(ownKey(ctx)) & weaknessBits(enemy);
      ctx.setCounter(enemy, ownKey(ctx), own);
      if (own === 0) ctx.removeStatus(enemy, implanted);
    }
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
