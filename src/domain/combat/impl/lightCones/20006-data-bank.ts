import { defineLightCone } from "../../kit/equipment";

/** Data Bank — Erudition. */
export default defineLightCone("20006", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { tags: ["ultimate"] },
  });
});
