import { defineLightCone } from "../../kit/equipment";

/** Landau's Choice — Preservation. DMG reduction is not modeled. */
export default defineLightCone("21009", (k) => {
  // "More likely to be attacked": #1 is the aggro increase (+200%).
  k.stat("lightCone", { stat: "aggroPct", value: k.s(1) });
});
