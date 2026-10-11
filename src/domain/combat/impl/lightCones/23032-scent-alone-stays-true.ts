import { defineLightCone } from "../../kit/equipment";

/**
 * Scent Alone Stays True — Abundance. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("23032", (k) => {
  const woefree = k.status({
    id: "woefree",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(5) },
    modifiers: [
      { stat: "vulnerability", value: k.s(2) },
      {
        stat: "vulnerability",
        scaling: {
          source: "applier",
          stat: "breakEffect",
          atLeast: k.s(3),
          ratio: k.s(4),
        },
      },
    ],
  });
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["ultimate"], attack: true },
    (ctx, event) => {
      for (const enemy of event.targetsHit ?? []) {
        ctx.applyStatus(enemy, woefree);
      }
    }
  );
});
