import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Amber — Preservation. DEF is applied from catalog properties. */
export default defineLightCone("20003", (k) => {
  const stasis = k.status({
    id: "amber-def",
    origin: "lightCone",
    modifiers: [{ stat: "defPct", value: k.s(3) }],
  });
  // HP starts full, so the extra DEF starts off.
  const sync = (ctx: BattleApi) => {
    const below = ctx.self.hpRatio < k.s(2) - 1e-9;
    if (below && !ctx.self.has(stasis)) ctx.applyStatus(ctx.self, stasis);
    else if (!below && ctx.self.has(stasis)) ctx.removeStatus(ctx.self, stasis);
  };
  k.on("hpChanged", "lightCone", {}, sync);
});
