import { defineLightCone } from "../../kit/equipment";

/** Fermata — Nihility. Break Effect is applied from catalog properties. */
export default defineLightCone("21022", (k) => {
  // Unfiltered by tag, so it reaches the wearer's DoTs too.
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { targetFamilies: ["shock", "windShear"] },
  });
});
