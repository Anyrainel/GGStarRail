import { defineLightCone } from "../../kit/equipment";

/** Sagacity — Erudition. */
export default defineLightCone("20020", (k) => {
  const genius = k.status({
    id: "genius",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    modifiers: [{ stat: "atkPct", value: k.s(1) }],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, genius)
  );
});
