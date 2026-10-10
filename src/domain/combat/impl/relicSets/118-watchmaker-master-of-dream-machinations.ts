import { isEnemy } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/**
 * Watchmaker, Master of Dream Machinations. Break Effect is applied from
 * catalog properties.
 */
export default defineRelicSet("118", {
  fourPiece: (k) => {
    const breakEffect = k.status({
      id: "watchmaker-break-effect",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      modifiers: [{ stat: "breakEffect", value: k.param(1) }],
      unique: true,
    });
    // Events do not carry an ability's target type: an Ultimate counts as
    // used "on an ally" when it aims at an ally or deals no DMG (see tracker).
    k.on(
      "actionStart",
      "relic4pc",
      {
        abilityKinds: ["ultimate"],
        when: (event) =>
          !event.attack ||
          (event.target !== undefined && !isEnemy(event.target)),
      },
      (ctx) => {
        for (const ally of ctx.allies) ctx.applyStatus(ally, breakEffect);
      }
    );
  },
});
