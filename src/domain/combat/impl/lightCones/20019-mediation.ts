import { defineLightCone } from "../../kit/equipment";

/** Mediation — Harmony. */
export default defineLightCone("20019", (k) => {
  // Copies from several wearers do not stack, like equipment team auras.
  const family = k.status({
    id: "mediation-family",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    modifiers: [{ stat: "spdFlat", value: k.s(1) }],
    unique: true,
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, family);
  });
});
