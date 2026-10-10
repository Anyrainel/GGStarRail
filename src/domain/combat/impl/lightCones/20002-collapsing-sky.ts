import { defineLightCone } from "../../kit/equipment";

/** Collapsing Sky — Destruction. */
export default defineLightCone("20002", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { tags: ["basic", "skill"] },
  });
});
