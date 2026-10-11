import { defineRelicSet } from "../../kit/equipment";

/** Rutilant Arena. CRIT Rate is applied from catalog properties. */
export default defineRelicSet("309", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "dmgBoost",
      filter: { tags: ["basic", "skill"] },
      scaling: {
        source: "holder",
        stat: "critRate",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
