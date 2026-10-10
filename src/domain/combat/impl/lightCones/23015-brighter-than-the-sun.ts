import { defineLightCone } from "../../kit/equipment";

/**
 * Brighter Than the Sun — Destruction. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23015", (k) => {
  const dragonsCall = k.status({
    id: "dragons-call",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    maxStacks: k.s(3),
    modifiers: [
      { stat: "atkPct", value: k.s(4) },
      { stat: "energyRegen", value: k.s(5) },
    ],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["basic"] }, (ctx) =>
    ctx.applyStatus(ctx.self, dragonsCall)
  );
});
