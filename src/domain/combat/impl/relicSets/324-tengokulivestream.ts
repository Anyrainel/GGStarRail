import { defineRelicSet } from "../../kit/equipment";

const SPENT = "tengoku:sp-spent-this-turn";

/** Tengoku@Livestream. CRIT DMG is applied from catalog properties. */
export default defineRelicSet("324", {
  twoPiece: (k) => {
    const livestream = k.status({
      id: "tengoku-crit-dmg",
      origin: "ornament",
      duration: { turns: k.param(4) },
      modifiers: [{ stat: "critDmg", value: k.param(3) }],
    });
    // Skill Points consumed by any ally during one turn (of any unit).
    k.on("turnStart", "ornament", { subject: "any" }, (ctx) =>
      ctx.setCounter(ctx.self, SPENT, 0)
    );
    k.on(
      "skillPointsChanged",
      "ornament",
      { subject: "ally", when: (event) => (event.delta ?? 0) < 0 },
      (ctx, event) => {
        const before = ctx.self.counter(SPENT);
        const after = before - (event.delta ?? 0);
        ctx.setCounter(ctx.self, SPENT, after);
        if (before + 1e-9 < k.param(2) && after + 1e-9 >= k.param(2)) {
          ctx.applyStatus(ctx.self, livestream);
        }
      }
    );
  },
});
