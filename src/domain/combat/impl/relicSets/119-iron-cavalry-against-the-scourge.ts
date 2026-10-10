import { defineRelicSet } from "../../kit/equipment";

/** Iron Cavalry Against the Scourge. Break Effect is applied from catalog properties. */
export default defineRelicSet("119", {
  fourPiece: (k) => {
    // Super Break DMG is Break DMG too, so it gets both parts at 250%.
    k.stat("relic4pc", {
      stat: "defIgnore",
      filter: { tags: ["break"] },
      scaling: {
        source: "holder",
        stat: "breakEffect",
        atLeast: k.param(1),
        ratio: k.param(3),
      },
    });
    k.stat("relic4pc", {
      stat: "defIgnore",
      filter: { tags: ["superBreak"] },
      scaling: {
        source: "holder",
        stat: "breakEffect",
        atLeast: k.param(2),
        ratio: k.param(4),
      },
    });
  },
});
