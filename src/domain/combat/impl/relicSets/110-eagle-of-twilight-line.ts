import { defineRelicSet } from "../../kit/equipment";

/** Eagle of Twilight Line. Wind DMG is applied from catalog properties. */
export default defineRelicSet("110", {
  fourPiece: (k) => {
    k.on("actionEnd", "relic4pc", { abilityKinds: ["ultimate"] }, (ctx) =>
      ctx.advanceAction(ctx.self, k.param(1))
    );
  },
});
