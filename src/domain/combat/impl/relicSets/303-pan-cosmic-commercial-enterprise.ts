import { defineRelicSet } from "../../kit/equipment";

/**
 * Pan-Cosmic Commercial Enterprise. Effect Hit Rate is applied from catalog
 * properties.
 */
export default defineRelicSet("303", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "atkPct",
      scaling: {
        source: "holder",
        stat: "effectHitRate",
        ratio: k.param(2),
        cap: k.param(3),
      },
    });
  },
});
