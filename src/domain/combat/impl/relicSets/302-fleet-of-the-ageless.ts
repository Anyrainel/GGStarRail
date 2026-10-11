import { defineRelicSet } from "../../kit/equipment";

/** Fleet of the Ageless. Max HP is applied from catalog properties. */
export default defineRelicSet("302", {
  twoPiece: (k) => {
    // Team aura gated on the wearer's (the aura applier's) SPD.
    k.teamStat("ornament", {
      stat: "atkPct",
      scaling: {
        source: "applier",
        stat: "spd",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
