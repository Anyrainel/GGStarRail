import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { StatusFamily } from "../../model/tags";

const DOT_FAMILIES: readonly StatusFamily[] = [
  "windShear",
  "burn",
  "shock",
  "bleed",
];

/**
 * Reforged Remembrance — Nihility. Effect Hit Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23022", (k) => {
  const prophet = k.status({
    id: "prophet",
    origin: "lightCone",
    maxStacks: k.s(4),
    modifiers: [
      { stat: "atkPct", value: k.s(2) },
      { stat: "defIgnore", value: k.s(3), filter: { tags: ["dot"] } },
    ],
  });
  const granted = (family: StatusFamily) => `reforged-remembrance:${family}`;
  // One stack per DoT type for the whole battle.
  const grant = (ctx: BattleApi, enemy: EnemyView) => {
    for (const family of DOT_FAMILIES) {
      if (ctx.self.counter(granted(family)) > 0 || !enemy.hasFamily(family)) {
        continue;
      }
      ctx.setCounter(ctx.self, granted(family), 1);
      ctx.applyStatus(ctx.self, prophet);
    }
  };

  k.on("hit", "lightCone", {}, (ctx, event) => {
    if (isEnemy(event.target)) grant(ctx, event.target);
  });
  // The wearer's own DoT ticks are DMG dealt to an afflicted enemy too.
  k.on(
    "dotTick",
    "lightCone",
    {
      subject: "enemy",
      when: (event, self) =>
        event.status !== undefined && event.unit.has(event.status, self),
    },
    (ctx, event) => {
      if (isEnemy(event.unit)) grant(ctx, event.unit);
    }
  );
});
