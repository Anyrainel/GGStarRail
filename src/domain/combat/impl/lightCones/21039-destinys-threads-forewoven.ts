import { defineLightCone } from "../../kit/equipment";

/**
 * Destiny's Threads Forewoven — Preservation. Effect RES is applied from
 * catalog properties.
 */
export default defineLightCone("21039", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    scaling: {
      source: "holder",
      stat: "def",
      step: k.s(2),
      ratio: k.s(3),
      cap: k.s(4),
    },
  });
});
