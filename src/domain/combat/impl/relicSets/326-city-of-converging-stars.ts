import { defineRelicSet } from "../../kit/equipment";

/** City of Converging Stars. */
export default defineRelicSet("326", {
  twoPiece: (k) => {
    const followUpAtk = k.status({
      id: "converging-stars-atk",
      origin: "ornament",
      duration: { turns: k.param(2) },
      modifiers: [{ stat: "atkPct", value: k.param(1) }],
    });
    k.on("actionStart", "ornament", { abilityKinds: ["followUp"] }, (ctx) =>
      ctx.applyStatus(ctx.self, followUpAtk)
    );
    // "In the current battle" after an enemy is defeated; identical auras
    // from several wearers do not stack.
    if (k.toggle("enemy-defeated", "ornament", "enemyDefeated", false)) {
      k.teamStat("ornament", { stat: "critDmg", value: k.param(3) }, "allies");
    }
  },
});
