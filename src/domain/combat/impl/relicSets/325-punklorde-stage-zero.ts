import { defineRelicSet } from "../../kit/equipment";

/** Punklorde Stage Zero. Elation is applied from catalog properties. */
export default defineRelicSet("325", {
  twoPiece: (k) => {
    // Tiers: 20% at 40% Elation, 32% in total at 80%. Reaching a tier once
    // keeps it; the steady panel is checked, so it holds from battle start.
    k.stat("ornament", {
      stat: "critDmg",
      scaling: {
        source: "holder",
        stat: "elation",
        atLeast: k.param(2),
        ratio: k.param(4),
      },
    });
    k.stat("ornament", {
      stat: "critDmg",
      scaling: {
        source: "holder",
        stat: "elation",
        atLeast: k.param(3),
        ratio: k.param(5) - k.param(4),
      },
    });
  },
});
