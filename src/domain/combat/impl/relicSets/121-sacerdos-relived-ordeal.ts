import { isEnemy } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/** Sacerdos' Relived Ordeal. SPD is applied from catalog properties. */
export default defineRelicSet("121", {
  fourPiece: (k) => {
    // Stacks from two wearers share the cap: the strongest copy applies.
    const critDmg = k.status({
      id: "sacerdos-crit-dmg",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      maxStacks: k.param(3),
      modifiers: [{ stat: "critDmg", value: k.param(1) }],
      unique: true,
    });
    // Only abilities aimed at a designated ally carry it as their target
    // (see tracker).
    k.on(
      "actionStart",
      "relic4pc",
      {
        abilityKinds: ["skill", "ultimate"],
        when: (event) => event.target !== undefined && !isEnemy(event.target),
      },
      (ctx, event) => {
        if (event.target) {
          ctx.applyStatus(event.target, critDmg, { stacks: ctx.weight });
        }
      }
    );
  },
});
