import { defineLightCone } from "../../kit/equipment";

/**
 * See You at the End — The Hunt. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("21062", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { tags: ["skill", "followUp"] },
  });
});
