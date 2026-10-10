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
    // EN "After the wearer uses"; ZH "when" (施放终结技时), followed: the
    // triggering Ultimate is boosted.
    k.on("actionStart", "relic4pc", { abilityKinds: ["ultimate"] }, (ctx) =>
      ctx.applyStatus(ctx.self, critDmg)
    );
  },
});
