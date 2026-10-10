import { defineLightCone } from "../../kit/equipment";

/**
 * Before the Tutorial Mission Starts — Nihility. Effect Hit Rate is applied
 * from catalog properties.
 */
export default defineLightCone("22000", (k) => {
  // The engine cannot tell whether a target's DEF is reduced: the toggle
  // stands for attacking at least one DEF-reduced enemy.
  const defReduced = k.toggle("def-reduced", "lightCone", "active", true);
  if (!defReduced) return;
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.s(2));
  });
});
