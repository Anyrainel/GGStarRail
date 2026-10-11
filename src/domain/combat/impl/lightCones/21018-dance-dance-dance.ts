import { defineLightCone } from "../../kit/equipment";

/** Dance! Dance! Dance! — Harmony. */
export default defineLightCone("21018", (k) => {
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    for (const ally of ctx.allies) ctx.advanceAction(ally, k.s(1));
  });
});
