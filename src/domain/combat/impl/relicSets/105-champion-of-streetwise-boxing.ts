import { defineRelicSet } from "../../kit/equipment";

/**
 * Champion of Streetwise Boxing. Physical DMG is applied from catalog
 * properties.
 */
export default defineRelicSet("105", {
  fourPiece: (k) => {
    const atk = k.status({
      id: "champion-atk",
      origin: "relic4pc",
      maxStacks: k.param(2),
      modifiers: [{ stat: "atkPct", value: k.param(1) }],
    });
    k.on("actionEnd", "relic4pc", { attack: true }, (ctx) =>
      ctx.applyStatus(ctx.self, atk, { stacks: ctx.weight })
    );
    // Enemy attacks reach the wearer with its aggro share.
    k.on("hitByEnemy", "relic4pc", {}, (ctx) =>
      ctx.applyStatus(ctx.self, atk, { stacks: ctx.weight })
    );
  },
});
