import type { BattleApi, BattleEvent, UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Journey, Forever Peaceful — Preservation. Shield amounts (and the Shield
 * Effect bonus) are not modeled.
 */
export default defineLightCone("21053", (k) => {
  // Held by every ally target while it has a Shield (any source); copies
  // from several wearers keep the strongest, like equipment team auras.
  const sweetDream = k.status({
    id: "journey-forever-peaceful-sweet-dream",
    origin: "lightCone",
    unique: true,
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const sync = (ctx: BattleApi, unit: UnitView | undefined) => {
    if (!unit || unit.kind === "enemy") return;
    const shielded = unit.hasFamily("shield");
    const held = unit.has(sweetDream, ctx.self);
    if (shielded && !held) ctx.applyStatus(unit, sweetDream);
    else if (!shielded && held) ctx.removeStatus(unit, sweetDream);
  };
  const shieldChange = {
    subject: "any",
    when: (event: BattleEvent) => event.status?.family === "shield",
  } as const;
  k.on("statusApplied", "lightCone", shieldChange, (ctx, event) =>
    sync(ctx, event.target)
  );
  k.on("statusRemoved", "lightCone", shieldChange, (ctx, event) =>
    sync(ctx, event.target)
  );
});
