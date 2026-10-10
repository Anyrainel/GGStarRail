import { defineRelicSet } from "../../kit/equipment";

/** Firmament Frontline: Glamoth. ATK is applied from catalog properties. */
export default defineRelicSet("311", {
  twoPiece: (k) => {
    // Two tiers: #4 from the first SPD threshold, raised to #5 at the second.
    k.stat("ornament", {
      stat: "dmgBoost",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.param(2),
        ratio: k.param(4),
      },
    });
    k.stat("ornament", {
      stat: "dmgBoost",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.param(3),
        ratio: k.param(5) - k.param(4),
      },
    });
  },
});
