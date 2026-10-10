import { defineRelicSet } from "../../kit/equipment";

/** Firesmith of Lava-Forging. Fire DMG is applied from catalog properties. */
export default defineRelicSet("107", {
  fourPiece: (k) => {
    k.stat("relic4pc", {
      stat: "dmgBoost",
      value: k.param(1),
      filter: { tags: ["skill"] },
    });
    const nextAttack = k.status({
      id: "firesmith-fire-dmg",
      origin: "relic4pc",
      modifiers: [
        {
          stat: "dmgBoost",
          value: k.param(2),
          filter: { combatTypes: ["Fire"] },
        },
      ],
    });
    // Registered first: an attacking Ultimate uses up a pending boost before
    // it grants the next one.
    k.on("actionEnd", "relic4pc", { attack: true }, (ctx) =>
      ctx.removeStatus(ctx.self, nextAttack)
    );
    k.on("actionEnd", "relic4pc", { abilityKinds: ["ultimate"] }, (ctx) =>
      ctx.applyStatus(ctx.self, nextAttack)
    );
  },
});
