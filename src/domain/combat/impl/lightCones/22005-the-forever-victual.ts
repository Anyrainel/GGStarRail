import { defineLightCone } from "../../kit/equipment";

/** The Forever Victual — Harmony. ATK is applied from catalog properties. */
export default defineLightCone("22005", (k) => {
  const soGood = k.status({
    id: "the-forever-victual",
    origin: "lightCone",
    maxStacks: k.s(3),
    modifiers: [{ stat: "atkPct", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["skill"] }, (ctx) =>
    ctx.applyStatus(ctx.self, soGood, { stacks: ctx.weight })
  );
});
