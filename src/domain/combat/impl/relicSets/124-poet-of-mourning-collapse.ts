import { defineRelicSet } from "../../kit/equipment";

/**
 * Poet of Mourning Collapse. Quantum DMG and the SPD reduction are applied
 * from catalog properties.
 */
export default defineRelicSet("124", {
  fourPiece: (k) => {
    // "Before entering battle": `applier` reads the wearer's steady panel,
    // so in-battle SPD buffs do not change the tier. Memosprites inherit the
    // wearer's permanent modifiers. "SPD lower than T" is the bonus minus
    // itself once SPD reaches T; the second tier adds the difference.
    const tiers = [
      { below: k.param(2), critRate: k.param(4) },
      { below: k.param(3), critRate: k.param(5) - k.param(4) },
    ];
    for (const tier of tiers) {
      k.stat("relic4pc", {
        stat: "critRate",
        value: tier.critRate,
        scaling: {
          source: "applier",
          stat: "spd",
          atLeast: tier.below,
          ratio: -tier.critRate,
        },
      });
    }
  },
});
