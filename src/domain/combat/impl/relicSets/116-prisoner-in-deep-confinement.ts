import { defineRelicSet } from "../../kit/equipment";

/**
 * Prisoner in Deep Confinement. ATK is applied from catalog properties.
 */
export default defineRelicSet("116", {
  fourPiece: (k) => {
    // Hit filters cannot count the DoTs on a target (engine-gap), so only
    // the first DoT counts, recognized by its family; #2 is unused.
    k.stat("relic4pc", {
      stat: "defIgnore",
      value: k.param(1),
      filter: { targetFamilies: ["burn", "shock", "bleed", "windShear"] },
    });
  },
});
