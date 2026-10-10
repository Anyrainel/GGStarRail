import { defineRelicSet } from "../../kit/equipment";

/** The Wind-Soaring Valorous. ATK and CRIT Rate are applied from catalog properties. */
export default defineRelicSet("120", {
  fourPiece: (k) => {
    const ultimateDmg = k.status({
      id: "wind-soaring-ultimate-dmg",
      origin: "relic4pc",
      duration: { turns: k.param(3) },
      modifiers: [
        { stat: "dmgBoost", value: k.param(2), filter: { tags: ["ultimate"] } },
      ],
    });
    k.on("actionEnd", "relic4pc", { abilityKinds: ["followUp"] }, (ctx) =>
      ctx.applyStatus(ctx.self, ultimateDmg)
    );
  },
});
