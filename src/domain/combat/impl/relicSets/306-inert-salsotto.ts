import { defineRelicSet } from "../../kit/equipment";

/** Inert Salsotto. CRIT Rate is applied from catalog properties. */
export default defineRelicSet("306", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "dmgBoost",
      filter: { tags: ["ultimate", "followUp"] },
      scaling: {
        source: "holder",
        stat: "critRate",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
