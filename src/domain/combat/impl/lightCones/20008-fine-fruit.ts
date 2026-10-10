import { defineLightCone } from "../../kit/equipment";

/** Fine Fruit — Abundance. */
export default defineLightCone("20008", (k) => {
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    for (const ally of ctx.allies) {
      // Memosprites have no Energy of their own.
      if (ally.kind === "character") ctx.gainEnergy(ally, k.s(1));
    }
  });
});
