import { defineLightCone } from "../../kit/equipment";

/** Race to the Horizon — The Hunt. ATK is applied from catalog properties. */
export default defineLightCone("22008", (k) => {
  const overtake = k.status({
    id: "overtake",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    maxStacks: k.s(4),
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  // Chance-based Follow-Up ATKs add their expected share of a stack.
  k.on("actionEnd", "lightCone", { abilityKinds: ["followUp"] }, (ctx) =>
    ctx.applyStatus(ctx.self, overtake, { stacks: ctx.weight })
  );
});
