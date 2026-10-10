import { defineRelicSet } from "../../kit/equipment";

/**
 * Messenger Traversing Hackerspace. SPD is applied from catalog properties.
 */
export default defineRelicSet("114", {
  fourPiece: (k) => {
    const spd = k.status({
      id: "messenger-spd",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      modifiers: [{ stat: "spdPct", value: k.param(1) }],
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
        for (const ally of ctx.allies) ctx.applyStatus(ally, spd);
      }
    );
  },
});
