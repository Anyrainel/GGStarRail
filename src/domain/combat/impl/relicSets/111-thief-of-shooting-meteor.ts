import { defineRelicSet } from "../../kit/equipment";

/**
 * Thief of Shooting Meteor. Break Effect (2-piece and 4-piece) is applied
 * from catalog properties.
 */
export default defineRelicSet("111", {
  fourPiece: (k) => {
    k.on("weaknessBreak", "relic4pc", {}, (ctx) =>
      ctx.gainEnergy(ctx.self, k.param(2))
    );
  },
});
