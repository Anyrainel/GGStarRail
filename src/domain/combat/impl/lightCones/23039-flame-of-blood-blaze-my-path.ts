import { defineLightCone } from "../../kit/equipment";

/**
 * Flame of Blood, Blaze My Path — Destruction. Max HP and Incoming Healing
 * are applied from catalog properties.
 */
export default defineLightCone("23039", (k) => {
  // HP is not simulated: the wearer is assumed to have the HP to pay, so
  // more than #4 HP is consumed once #2 of Max HP exceeds it. The consumption
  // does not feed the wearer's own HP-loss mechanics (engine-gap).
  const vista = k.status({
    id: "vista",
    origin: "lightCone",
    modifiers: [
      { stat: "dmgBoost", value: k.s(3) },
      {
        stat: "dmgBoost",
        scaling: {
          source: "holder",
          stat: "hp",
          atLeast: k.s(4) / k.s(2),
          ratio: k.s(5),
        },
      },
    ],
  });
  const kinds = { abilityKinds: ["skill", "ultimate"] } as const;
  k.on("actionStart", "lightCone", kinds, (ctx) =>
    ctx.applyStatus(ctx.self, vista)
  );
  k.on("actionEnd", "lightCone", kinds, (ctx) =>
    ctx.removeStatus(ctx.self, vista)
  );
});
