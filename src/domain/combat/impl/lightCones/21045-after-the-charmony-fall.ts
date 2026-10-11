import { defineLightCone } from "../../kit/equipment";

/**
 * After the Charmony Fall — Erudition. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("21045", (k) => {
  const quiescence = k.status({
    id: "quiescence",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "spdPct", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, quiescence)
  );
});
