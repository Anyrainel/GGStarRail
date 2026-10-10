import { defineRelicSet } from "../../kit/equipment";

/** The Ashblazing Grand Duke. */
export default defineRelicSet("115", {
  twoPiece: (k) => {
    k.stat("relic2pc", {
      stat: "dmgBoost",
      value: k.param(1),
      filter: { tags: ["followUp"] },
    });
  },
  fourPiece: (k) => {
    const stacks = k.status({
      id: "ashblazing",
      origin: "relic4pc",
      maxStacks: k.param(2),
      duration: { turns: k.param(3) },
      modifiers: [{ stat: "atkPct", value: k.param(1) }],
    });
    // "Removed the next time the wearer uses a Follow-Up ATK."
    k.on("actionStart", "relic4pc", { abilityKinds: ["followUp"] }, (ctx) =>
      ctx.removeStatus(ctx.self, stacks)
    );
    // Every damage instance of the Follow-Up ATK adds a stack, so later
    // instances of the same attack are stronger.
    k.on("hit", "relic4pc", { tags: ["followUp"] }, (ctx) =>
      ctx.applyStatus(ctx.self, stacks)
    );
  },
});
