import { defineRelicSet } from "../../kit/equipment";

/** The Edacious Heretic. CRIT DMG is applied from catalog properties. */
export default defineRelicSet("134", {
  fourPiece: (k) => {
    k.stat("relic4pc", {
      stat: "dmgBoost",
      value: k.param(1),
      filter: { tags: ["basic"] },
    });
    const atk = k.status({
      id: "edacious-atk",
      origin: "relic4pc",
      duration: { turns: k.param(3) },
      modifiers: [{ stat: "atkPct", value: k.param(2) }],
    });
    k.on("actionStart", "relic4pc", { abilityKinds: ["basic"] }, (ctx) =>
      ctx.applyStatus(ctx.self, atk)
    );
  },
});
