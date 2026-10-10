import type { BattleApi, UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Unto Tomorrow's Morrow — Abundance. Outgoing Healing is applied from
 * catalog properties.
 */
export default defineLightCone("21055", (k) => {
  const farewell = k.status({
    id: "unto-tomorrows-morrow-dmg",
    origin: "lightCone",
    unique: true,
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  // Ally targets: Characters and memosprites, synced with their own HP.
  const sync = (ctx: BattleApi, unit: UnitView) => {
    if (unit.kind !== "character" && unit.kind !== "memosprite") return;
    const above = unit.hpRatio >= k.s(2) - 1e-9;
    if (above && !unit.has(farewell)) ctx.applyStatus(unit, farewell);
    else if (!above && unit.has(farewell)) ctx.removeStatus(unit, farewell);
  };
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    for (const ally of ctx.allies) sync(ctx, ally);
  });
  k.on("summoned", "lightCone", { subject: "ally" }, (ctx, event) =>
    sync(ctx, event.unit)
  );
  k.on("hpChanged", "lightCone", { subject: "ally" }, (ctx, event) =>
    sync(ctx, event.unit)
  );
});
