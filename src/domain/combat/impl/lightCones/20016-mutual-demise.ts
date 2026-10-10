import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Mutual Demise — Destruction. */
export default defineLightCone("20016", (k) => {
  const legion = k.status({
    id: "mutual-demise-crit-rate",
    origin: "lightCone",
    modifiers: [{ stat: "critRate", value: k.s(2) }],
  });
  // HP starts full, so the CRIT Rate starts off.
  const sync = (ctx: BattleApi) => {
    const below = ctx.self.hpRatio < k.s(1) - 1e-9;
    if (below && !ctx.self.has(legion)) ctx.applyStatus(ctx.self, legion);
    else if (!below && ctx.self.has(legion)) ctx.removeStatus(ctx.self, legion);
  };
  k.on("hpChanged", "lightCone", {}, sync);
});
