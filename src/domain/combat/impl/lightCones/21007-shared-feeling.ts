import { defineLightCone } from "../../kit/equipment";

/**
 * Shared Feeling — Abundance. Outgoing Healing is applied from catalog
 * properties.
 */
export default defineLightCone("21007", (k) => {
  k.on("actionStart", "lightCone", { abilityKinds: ["skill"] }, (ctx) => {
    for (const ally of ctx.allies) {
      // Memosprites have no Energy of their own.
      if (ally.kind === "character") ctx.gainEnergy(ally, k.s(2));
    }
  });
});
