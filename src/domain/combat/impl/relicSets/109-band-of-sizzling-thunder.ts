import { defineRelicSet } from "../../kit/equipment";

/**
 * Band of Sizzling Thunder. Lightning DMG is applied from catalog
 * properties.
 */
export default defineRelicSet("109", {
  fourPiece: (k) => {
    const atk = k.status({
      id: "band-atk",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      modifiers: [{ stat: "atkPct", value: k.param(1) }],
    });
    k.on("actionStart", "relic4pc", { abilityKinds: ["skill"] }, (ctx) =>
      ctx.applyStatus(ctx.self, atk)
    );
  },
});
