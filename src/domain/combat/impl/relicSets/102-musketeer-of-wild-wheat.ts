import { defineRelicSet } from "../../kit/equipment";

/** Musketeer of Wild Wheat. ATK% and SPD% are applied from catalog properties. */
export default defineRelicSet("102", {
  fourPiece: (k) => {
    k.stat("relic4pc", {
      stat: "dmgBoost",
      value: k.param(2),
      filter: { tags: ["basic"] },
    });
  },
});
