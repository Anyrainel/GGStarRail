import { defineRelicSet } from "../../kit/equipment";

/**
 * Prisoner in Deep Confinement. ATK is applied from catalog properties.
 */
export default defineRelicSet("116", {
  fourPiece: (k) => {
    // One tier per DoT on the target, up to #2 DoTs.
    for (let dots = 1; dots <= k.param(2); dots += 1) {
      k.stat("relic4pc", {
        stat: "defIgnore",
        value: k.param(1),
        filter: { minTargetDots: dots },
      });
    }
  },
});
