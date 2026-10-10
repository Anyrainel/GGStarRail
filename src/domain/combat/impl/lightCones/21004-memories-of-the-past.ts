import { defineLightCone } from "../../kit/equipment";

/**
 * Memories of the Past — Harmony. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("21004", (k) => {
  k.on("actionEnd", "lightCone", { attack: true, limitPerTurn: 1 }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.s(2));
  });
});
