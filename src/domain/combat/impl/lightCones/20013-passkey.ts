import { defineLightCone } from "../../kit/equipment";

/** Passkey — Erudition. */
export default defineLightCone("20013", (k) => {
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["skill"], limitPerTurn: 1 },
    (ctx) => {
      ctx.gainEnergy(ctx.self, k.s(1));
    }
  );
});
