import { defineLightCone } from "../../kit/equipment";

/**
 * Eyes of the Prey — Nihility. Effect Hit Rate is applied from catalog
 * properties.
 */
export default defineLightCone("21008", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { tags: ["dot"] },
  });
});
