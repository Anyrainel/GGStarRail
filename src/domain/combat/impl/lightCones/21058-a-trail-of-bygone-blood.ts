import { defineLightCone } from "../../kit/equipment";

/**
 * A Trail of Bygone Blood — Destruction. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("21058", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { tags: ["skill", "ultimate"] },
  });
});
