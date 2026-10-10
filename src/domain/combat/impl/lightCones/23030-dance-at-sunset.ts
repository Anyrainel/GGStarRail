import { defineLightCone } from "../../kit/equipment";

/**
 * Dance at Sunset — Destruction. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23030", (k) => {
  // "Greatly increases the chance of getting attacked": #4, not referenced
  // by the text, is the aggro increase (+500%).
  k.stat("lightCone", { stat: "aggroPct", value: k.s(4) });
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
