import { defineLightCone } from "../../kit/equipment";

/** Tomorrow, Together — Elation. CRIT DMG is applied from catalog properties. */
export default defineLightCone("22007", (k) => {
  const companion = k.status({
    id: "tomorrow-together-companion",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "elation", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, companion);
  });
});
