import { defineRelicSet } from "../../kit/equipment";

/**
 * Sprightly Vonwacq. Energy Regeneration Rate is applied from catalog
 * properties.
 */
export default defineRelicSet("308", {
  twoPiece: (k) => {
    const minSpd = k.param(2);
    const advance = k.param(3);
    k.on(
      "battleStart",
      "ornament",
      {
        subject: "any",
        when: (_event, self) => self.panelStat("spd") + 1e-9 >= minSpd,
      },
      (ctx) => ctx.advanceAction(ctx.self, advance)
    );
  },
});
