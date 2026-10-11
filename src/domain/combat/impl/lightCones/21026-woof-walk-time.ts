import { defineLightCone } from "../../kit/equipment";

/** Woof! Walk Time! — Destruction. ATK is applied from catalog properties. */
export default defineLightCone("21026", (k) => {
  // Unfiltered by tag, so it reaches the wearer's DoTs too.
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { targetFamilies: ["burn", "bleed"] },
  });
});
