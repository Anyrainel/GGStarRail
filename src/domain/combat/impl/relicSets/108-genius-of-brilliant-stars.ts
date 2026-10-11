import { defineRelicSet } from "../../kit/equipment";

/** Genius of Brilliant Stars. Quantum DMG is applied from catalog properties. */
export default defineRelicSet("108", {
  fourPiece: (k) => {
    k.stat("relic4pc", { stat: "defIgnore", value: k.param(1) });
    k.stat("relic4pc", {
      stat: "defIgnore",
      value: k.param(2),
      filter: { targetWeakness: ["Quantum"] },
    });
  },
});
