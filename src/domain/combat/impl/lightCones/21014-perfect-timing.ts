import { defineLightCone } from "../../kit/equipment";

/** Perfect Timing — Abundance. Effect RES is applied from catalog properties. */
export default defineLightCone("21014", (k) => {
  k.stat("lightCone", {
    stat: "outgoingHealing",
    scaling: {
      source: "holder",
      stat: "effectRes",
      ratio: k.s(2),
      cap: k.s(3),
    },
  });
});
