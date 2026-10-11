import { defineRelicSet } from "../../kit/equipment";

/** Talia: Kingdom of Banditry. Break Effect is applied from catalog properties. */
export default defineRelicSet("307", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "breakEffect",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
