import { defineRelicSet } from "../../kit/equipment";

/** Belobog of the Architects. DEF is applied from catalog properties. */
export default defineRelicSet("304", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "defPct",
      scaling: {
        source: "holder",
        stat: "effectHitRate",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
