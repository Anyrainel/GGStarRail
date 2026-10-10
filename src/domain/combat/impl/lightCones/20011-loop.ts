import { defineLightCone } from "../../kit/equipment";

/** Loop — Nihility. */
export default defineLightCone("20011", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { targetFamilies: ["slow"] },
  });
});
