import { defineRelicSet } from "../../kit/equipment";

/**
 * Wastelander of Banditry Desert. Imaginary DMG is applied from catalog
 * properties.
 */
export default defineRelicSet("112", {
  fourPiece: (k) => {
    k.stat("relic4pc", {
      stat: "critRate",
      value: k.param(1),
      filter: { minTargetDebuffs: 1 },
    });
    k.stat("relic4pc", {
      stat: "critDmg",
      value: k.param(2),
      filter: { targetFamilies: ["imprisonment"] },
    });
  },
});
