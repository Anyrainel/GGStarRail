import { defineRelicSet } from "../../kit/equipment";

/** Scholar Lost in Erudition. CRIT Rate is applied from catalog properties. */
export default defineRelicSet("122", {
  fourPiece: (k) => {
    k.stat("relic4pc", {
      stat: "dmgBoost",
      value: k.param(1),
      filter: { tags: ["skill", "ultimate"] },
    });
    const nextSkill = k.status({
      id: "scholar-next-skill",
      origin: "relic4pc",
      modifiers: [
        { stat: "dmgBoost", value: k.param(2), filter: { tags: ["skill"] } },
      ],
    });
    k.on("actionEnd", "relic4pc", { abilityKinds: ["ultimate"] }, (ctx) =>
      ctx.applyStatus(ctx.self, nextSkill)
    );
    k.on("actionEnd", "relic4pc", { abilityKinds: ["skill"] }, (ctx) =>
      ctx.removeStatus(ctx.self, nextSkill)
    );
  },
});
