import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

/**
 * Why Does the Ocean Sing — Nihility. Effect Hit Rate is applied from
 * catalog properties. Being knocked down is not simulated, so Enthrallment
 * is never removed early.
 */
export default defineLightCone("23047", (k) => {
  const maxStacks = k.s(5);
  // Stacks follow the wearer's debuffs on the target; Enthrallment is one
  // of them.
  const enthrallment = k.status({
    id: "enthrallment",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(3) },
    maxStacks,
    modifiers: [
      { stat: "vulnerability", value: k.s(4), filter: { tags: ["dot"] } },
    ],
  });
  const enthralledSpd = k.status({
    id: "enthrallment-spd",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(7) },
    modifiers: [{ stat: "spdPct", value: k.s(6) }],
  });

  const ownDebuffs = new Set<StatusDef>([enthrallment]);
  const sync = (ctx: BattleApi, enemy: EnemyView) => {
    if (!enemy.has(enthrallment, ctx.self)) return;
    let count = 0;
    for (const debuff of ownDebuffs) {
      if (enemy.has(debuff, ctx.self)) count += 1;
    }
    const stacks = Math.min(maxStacks, Math.max(1, count));
    if (Math.abs(enemy.stacks(enthrallment, ctx.self) - stacks) > 1e-9) {
      ctx.setStatusStacks(enemy, enthrallment, stacks);
    }
  };

  k.on(
    "statusApplied",
    "lightCone",
    {
      when: (event) =>
        isEnemy(event.target) &&
        event.status?.debuff === true &&
        event.status !== enthrallment,
    },
    (ctx, event) => {
      if (!isEnemy(event.target) || !event.status) return;
      ownDebuffs.add(event.status);
      ctx.applyStatus(event.target, enthrallment, {
        setStacks: 1,
        baseChance: k.s(2),
      });
      sync(ctx, event.target);
    }
  );
  // Debuffs expire at enemy turn ends: recount before anyone deals DMG.
  k.on("actionStart", "lightCone", { subject: "ally" }, (ctx) => {
    for (const enemy of ctx.enemies) sync(ctx, enemy);
  });
  k.on("turnStart", "lightCone", { subject: "enemy" }, (ctx, event) => {
    if (isEnemy(event.unit)) sync(ctx, event.unit);
  });

  k.on(
    "actionEnd",
    "lightCone",
    {
      subject: "ally",
      attack: true,
      when: (event, self) =>
        (event.targetsHit ?? []).some((enemy) => enemy.has(enthrallment, self)),
    },
    (ctx, event) => ctx.applyStatus(event.unit, enthralledSpd)
  );
});
