import { defineRelicSet } from "../../kit/equipment";

/**
 * Bone Collection's Serene Demesne. Max HP is applied from catalog
 * properties; memosprites inherit the wearer's modifiers and Max HP.
 */
export default defineRelicSet("319", {
  twoPiece: (k) => {
    k.stat("ornament", {
      stat: "critDmg",
      scaling: {
        source: "holder",
        stat: "hp",
        atLeast: k.param(2),
        ratio: k.param(3),
      },
    });
  },
});
