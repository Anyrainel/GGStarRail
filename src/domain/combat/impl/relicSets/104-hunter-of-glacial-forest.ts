import { defineRelicSet } from "../../kit/equipment";

/** Hunter of Glacial Forest. Ice DMG is applied from catalog properties. */
export default defineRelicSet("104", {
  fourPiece: (k) => {
    const critDmg = k.status({
      id: "hunter-crit-dmg",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      modifiers: [{ stat: "critDmg", value: k.param(1) }],
    });
    // EN: "After the wearer uses their Ultimate"; ZH reads "when" (施放终结技
    // 时). Applied after the Ultimate resolves, so the triggering Ultimate is
    // not boosted (see tracker).
    k.on("actionEnd", "relic4pc", { abilityKinds: ["ultimate"] }, (ctx) =>
      ctx.applyStatus(ctx.self, critDmg)
    );
  },
});
