import { defineLightCone } from "../../kit/equipment";

/**
 * I Venture Forth to Hunt — The Hunt. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23031", (k) => {
  const luminflux = k.status({
    id: "luminflux",
    origin: "lightCone",
    maxStacks: k.s(3),
    modifiers: [
      { stat: "defIgnore", value: k.s(2), filter: { tags: ["ultimate"] } },
    ],
  });
  // Chance-based Follow-Up ATKs add their expected share of a stack.
  k.on("actionStart", "lightCone", { abilityKinds: ["followUp"] }, (ctx) =>
    ctx.applyStatus(ctx.self, luminflux, { stacks: ctx.weight })
  );
  k.on("turnEnd", "lightCone", {}, (ctx) =>
    ctx.consumeStacks(ctx.self, luminflux, 1)
  );
});
