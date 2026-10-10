import { defineLightCone } from "../../kit/equipment";

/** The Day The Cosmos Fell — Erudition. ATK is applied from catalog properties. */
export default defineLightCone("21040", (k) => {
  const stratagem = k.status({
    id: "stratagem",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  // "The corresponding Weakness" is the wearer's Combat Type.
  k.on(
    "actionEnd",
    "lightCone",
    {
      attack: true,
      when: (event, self) =>
        (event.targetsHit ?? []).filter((enemy) =>
          enemy.weaknesses.has(self.combatType)
        ).length >= 2,
    },
    (ctx) => ctx.applyStatus(ctx.self, stratagem)
  );
});
