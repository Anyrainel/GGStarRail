import { defineRelicSet } from "../../kit/equipment";

/**
 * Izumo Gensei and Takama Divine Realm. ATK is applied from catalog
 * properties.
 */
export default defineRelicSet("314", {
  twoPiece: (k) => {
    // The team includes the wearer, so a teammate on its Path makes two.
    if (k.countPath(k.wearer.pathId) >= 2) {
      k.stat("ornament", { stat: "critRate", value: k.param(2) });
    }
  },
});
