import { defineLightCone } from "../../kit/equipment";

/**
 * Dance at Sunset — Destruction. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23030", (k) => {
  // The aggro increase is not modeled (engine-gap).
  const firedance = k.status({
    id: "firedance",
    origin: "lightCone",
    // "Lasting for 2 turns" (no placeholder).
    duration: { turns: 2 },
    maxStacks: k.s(2),
    modifiers: [
      { stat: "dmgBoost", value: k.s(3), filter: { tags: ["followUp"] } },
    ],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, firedance)
  );
});
