import { defineLightCone } from "../../kit/equipment";

/**
 * Indelible Promise — Destruction. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("21042", (k) => {
  const inheritance = k.status({
    id: "inheritance",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critRate", value: k.s(2) }],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, inheritance)
  );
});
