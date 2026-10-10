import { defineLightCone } from "../../kit/equipment";

/** What Is Real? — Abundance. Break Effect is applied from catalog properties. */
export default defineLightCone("21035", (k) => {
  k.on("actionEnd", "lightCone", { abilityKinds: ["basic"] }, (ctx) => {
    const boost = 1 + ctx.self.currentStat("outgoingHealing");
    const flat = k.s(3) / ctx.self.currentStat("hp");
    ctx.heal(ctx.self, (k.s(2) + flat) * boost);
  });
});
