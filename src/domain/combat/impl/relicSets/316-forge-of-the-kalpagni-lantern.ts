import { isEnemy } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/** Forge of the Kalpagni Lantern. SPD is applied from catalog properties. */
export default defineRelicSet("316", {
  twoPiece: (k) => {
    const lantern = k.status({
      id: "kalpagni-lantern",
      origin: "ornament",
      duration: { turns: k.param(3) },
      modifiers: [{ stat: "breakEffect", value: k.param(2) }],
    });
    k.on(
      "hit",
      "ornament",
      {
        when: (event) =>
          isEnemy(event.target) && event.target.weaknesses.has("Fire"),
      },
      (ctx) => ctx.applyStatus(ctx.self, lantern)
    );
  },
});
