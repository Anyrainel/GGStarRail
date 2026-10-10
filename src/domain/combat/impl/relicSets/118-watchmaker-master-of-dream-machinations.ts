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
    // "On an ally" (对我方目标): one ally, all allies, or the wearer.
    k.on(
      "actionStart",
      "relic4pc",
      {
        abilityKinds: ["ultimate"],
        when: (event) =>
          event.abilityTarget === "ally" ||
          event.abilityTarget === "allies" ||
          event.abilityTarget === "self",
      },
      (ctx) => {
        for (const ally of ctx.allies) ctx.applyStatus(ally, breakEffect);
      }
    );
  },
});
