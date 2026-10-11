import { defineRelicSet } from "../../kit/equipment";

/** Revelry by the Sea. ATK is applied from catalog properties. */
export default defineRelicSet("322", {
  twoPiece: (k) => {
    // Tiers "respectively": 12% at 2400 ATK, 24% in total at 3600 ATK.
    k.stat("ornament", {
      stat: "dmgBoost",
      filter: { tags: ["dot"] },
      scaling: {
        source: "holder",
        stat: "atk",
        atLeast: k.param(2),
        ratio: k.param(4),
      },
    });
    k.stat("ornament", {
      stat: "dmgBoost",
      filter: { tags: ["dot"] },
      scaling: {
        source: "holder",
        stat: "atk",
        atLeast: k.param(3),
        ratio: k.param(5) - k.param(4),
      },
    });
  },
});
