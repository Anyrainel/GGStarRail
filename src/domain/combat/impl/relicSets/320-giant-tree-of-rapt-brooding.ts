import { defineRelicSet } from "../../kit/equipment";

/**
 * Giant Tree of Rapt Brooding. SPD is applied from catalog properties;
 * memosprites inherit the wearer's modifiers and read the wearer's SPD.
 */
export default defineRelicSet("320", {
  twoPiece: (k) => {
    // Tiers: 12% at 135 SPD, 20% in total at 180 SPD.
    k.stat("ornament", {
      stat: "outgoingHealing",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.param(2),
        ratio: k.param(4),
      },
    });
    k.stat("ornament", {
      stat: "outgoingHealing",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.param(3),
        ratio: k.param(5) - k.param(4),
      },
    });
  },
});
