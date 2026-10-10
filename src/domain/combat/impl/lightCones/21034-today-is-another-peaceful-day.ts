import { defineLightCone } from "../../kit/equipment";

/** Today Is Another Peaceful Day — Erudition. */
export default defineLightCone("21034", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    scaling: {
      source: "holder",
      stat: "maxEnergy",
      ratio: k.s(1),
      cap: k.s(1) * k.s(2),
    },
  });
});
