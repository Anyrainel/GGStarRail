import { defineRelicSet } from "../../kit/equipment";

/** Space Sealing Station. ATK is applied from catalog properties. */
export default defineRelicSet("301", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "atkPct",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
