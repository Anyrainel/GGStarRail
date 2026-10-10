import { defineLightCone } from "../../kit/equipment";

/** Pioneering — Preservation. */
export default defineLightCone("20017", (k) => {
  k.on("weaknessBreak", "lightCone", {}, (ctx) => {
    const boost = 1 + ctx.self.currentStat("outgoingHealing");
    ctx.heal(ctx.self, k.s(1) * boost);
  });
});
