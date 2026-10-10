import { defineRelicSet } from "../../kit/equipment";

/**
 * Guard of Wuthering Snow. The 2-piece DMG reduction and the 4-piece healing
 * are not modelled (U12).
 */
export default defineRelicSet("106", {
  fourPiece: (k) => {
    // HP is not simulated: one assumption that the wearer starts every turn
    // at or below #1 of its Max HP.
    const lowHp = k.toggle(
      "low-hp",
      "relic4pc",
      "selfHpBelow",
      false,
      k.param(1)
    );
    if (!lowHp) return;
    k.on("turnStart", "relic4pc", {}, (ctx) =>
      ctx.gainEnergy(ctx.self, k.param(3))
    );
  },
});
