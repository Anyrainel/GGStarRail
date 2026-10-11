import { defineRelicSet } from "../../kit/equipment";

/** As Navigator Isee Sees It. ATK is applied from catalog properties. */
export default defineRelicSet("131", {
  fourPiece: (k) => {
    const dmg = k.status({
      id: "navigator-dmg",
      origin: "relic4pc",
      maxStacks: k.param(2),
      modifiers: [
        {
          stat: "dmgBoost",
          value: k.param(1),
          filter: { tags: ["skill", "ultimate"] },
        },
      ],
    });
    k.on("battleStart", "relic4pc", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, dmg)
    );
    k.on("actionStart", "relic4pc", { abilityKinds: ["skill"] }, (ctx) =>
      ctx.applyStatus(ctx.self, dmg, { stacks: ctx.weight })
    );
    k.on("turnStart", "relic4pc", {}, (ctx) =>
      ctx.consumeStacks(ctx.self, dmg, k.param(3))
    );
    k.on("actionEnd", "relic4pc", { abilityKinds: ["ultimate"] }, (ctx) =>
      ctx.consumeStacks(ctx.self, dmg, k.param(3) * ctx.weight)
    );
  },
});
