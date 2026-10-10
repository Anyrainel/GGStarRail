import { defineLightCone } from "../../kit/equipment";

/** Subscribe for More! — The Hunt. */
export default defineLightCone("21017", (k) => {
  const basicAndSkill = { tags: ["basic", "skill"] as const };
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: basicAndSkill,
  });
  const fullEnergy = k.status({
    id: "like-before-you-leave-full-energy",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(2), filter: basicAndSkill }],
  });
  // Energy is checked when each of the wearer's actions starts.
  k.on("actionStart", "lightCone", {}, (ctx) => {
    if (ctx.self.energy >= ctx.self.maxEnergy - 1e-9) {
      if (!ctx.self.has(fullEnergy)) ctx.applyStatus(ctx.self, fullEnergy);
    } else {
      ctx.removeStatus(ctx.self, fullEnergy);
    }
  });
});
