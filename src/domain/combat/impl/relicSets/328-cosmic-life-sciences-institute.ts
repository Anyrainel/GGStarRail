import { defineRelicSet } from "../../kit/equipment";

/** Cosmic Life Sciences Institute. */
export default defineRelicSet("328", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "dmgBoost",
      scaling: {
        source: "holder",
        stat: "maxEnergy",
        threshold: k.param(1),
        step: 1,
        ratio: k.param(2),
        cap: k.param(3),
      },
    });
  },
});
