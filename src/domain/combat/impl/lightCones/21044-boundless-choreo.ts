import { defineLightCone } from "../../kit/equipment";

/** Boundless Choreo — Nihility. CRIT Rate is applied from catalog properties. */
export default defineLightCone("21044", (k) => {
  k.stat("lightCone", {
    stat: "critDmg",
    value: k.s(2),
    filter: { targetFamilies: ["slow", "defReduced"] },
  });
});
