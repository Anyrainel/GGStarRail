import { defineLightCone } from "../../kit/equipment";

/** For Tomorrow's Journey — Harmony. ATK is applied from catalog properties. */
export default defineLightCone("22002", (k) => {
  const bonds = k.status({
    id: "for-tomorrows-journey",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, bonds)
  );
});
