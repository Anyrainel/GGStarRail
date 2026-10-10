import { defineRelicSet } from "../../kit/equipment";

/** Longevous Disciple. Max HP is applied from catalog properties. */
export default defineRelicSet("113", {
  fourPiece: (k) => {
    const critRate = k.status({
      id: "longevous-crit-rate",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      maxStacks: k.param(3),
      modifiers: [{ stat: "critRate", value: k.param(1) }],
    });
    // Enemy attacks reach the wearer with its aggro share.
    k.on("hitByEnemy", "relic4pc", {}, (ctx) =>
      ctx.applyStatus(ctx.self, critRate, { stacks: ctx.weight })
    );
    // HP consumed by the wearer or any ally.
    k.on(
      "hpChanged",
      "relic4pc",
      { when: (event) => event.hpCause === "consume" },
      (ctx) => ctx.applyStatus(ctx.self, critRate, { stacks: ctx.weight })
    );
  },
});
