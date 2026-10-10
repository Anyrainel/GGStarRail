import { isEnemy } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/** Dreamlit Actor. SPD is applied from catalog properties. */
export default defineRelicSet("133", {
  fourPiece: (k) => {
    const elation = k.status({
      id: "dreamlit-elation",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      modifiers: [{ stat: "elation", value: k.param(1) }],
      unique: true,
    });
    const critDmg = k.status({
      id: "dreamlit-crit-dmg",
      origin: "relic4pc",
      duration: { turns: k.param(5) },
      modifiers: [{ stat: "critDmg", value: k.param(4) }],
      unique: true,
    });
    // "On one other ally target" (我方其他单体目标): the ally the ability
    // names, other than the wearer.
    k.on(
      "actionStart",
      "relic4pc",
      {
        abilityKinds: ["skill", "ultimate"],
        when: (event, self) =>
          event.abilityTarget === "ally" &&
          event.target !== undefined &&
          !isEnemy(event.target) &&
          event.target.id !== self.id,
      },
      (ctx, event) => {
        if (!event.target) return;
        ctx.applyStatus(event.target, elation);
        if (ctx.self.certifiedBanger() + 1e-9 >= k.param(3)) {
          for (const ally of ctx.allies) ctx.applyStatus(ally, critDmg);
        }
      }
    );
  },
});
