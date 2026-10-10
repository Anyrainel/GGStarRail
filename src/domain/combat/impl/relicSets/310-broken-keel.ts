import { defineRelicSet } from "../../kit/equipment";

/** Broken Keel. Effect RES is applied from catalog properties. */
export default defineRelicSet("310", {
  twoPiece: (k) => {
    // Team aura gated on the wearer's (the aura applier's) Effect RES.
    k.teamStat("ornament", {
      stat: "critDmg",
      scaling: {
        source: "applier",
        stat: "effectRes",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
