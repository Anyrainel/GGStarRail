import { defineRelicSet } from "../../kit/equipment";

/** Celestial Differentiator. CRIT DMG is applied from catalog properties. */
export default defineRelicSet("305", {
  twoPiece: (k) => {
    // The CRIT DMG check sits on the modifier so the optimizer sees it; it
    // is evaluated when the first attack lands rather than on entering
    // battle, which only differs if buffs push CRIT DMG over the threshold.
    const firstAttack = k.status({
      id: "celestial-differentiator",
      origin: "ornament",
      modifiers: [
        {
          stat: "critRate",
          scaling: {
            source: "holder",
            stat: "critDmg",
            atLeast: k.param(2),
            ratio: k.param(3),
          },
        },
      ],
    });
    k.on("battleStart", "ornament", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, firstAttack)
    );
    k.on("actionEnd", "ornament", { attack: true }, (ctx) =>
      ctx.removeStatus(ctx.self, firstAttack)
    );
  },
});
