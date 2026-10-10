import { defineLightCone } from "../../kit/equipment";

/**
 * A Dream Scented in Wheat — Erudition. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("21060", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { tags: ["ultimate", "followUp"] },
  });
});
