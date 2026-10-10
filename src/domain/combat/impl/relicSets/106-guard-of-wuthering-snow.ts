import { defineRelicSet } from "../../kit/equipment";

/**
 * Guard of Wuthering Snow. The 2-piece DMG reduction is not modelled (U12).
 */
export default defineRelicSet("106", {
  fourPiece: (k) => {
    k.on(
      "turnStart",
      "relic4pc",
      { when: (_event, self) => self.hpRatio <= k.param(1) + 1e-9 },
      (ctx) => {
        const boost = 1 + ctx.self.panelStat("outgoingHealing");
        ctx.heal(ctx.self, k.param(2) * boost);
        ctx.gainEnergy(ctx.self, k.param(3));
      }
    );
  },
});
