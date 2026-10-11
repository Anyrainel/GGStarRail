import { defineLightCone } from "../../kit/equipment";

/** Multiplication — Abundance. */
export default defineLightCone("20015", (k) => {
  // The gauge is reset when the turn starts, so this advances the next action.
  k.on("actionEnd", "lightCone", { abilityKinds: ["basic"] }, (ctx) =>
    ctx.advanceAction(ctx.self, k.s(1))
  );
});
