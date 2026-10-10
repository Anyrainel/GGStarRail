import { defineLightCone } from "../../kit/equipment";

/** Make the World Clamor — Erudition. */
export default defineLightCone("21013", (k) => {
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.s(2));
  });
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { tags: ["ultimate"] },
  });
});
