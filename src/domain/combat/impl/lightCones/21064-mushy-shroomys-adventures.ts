import { defineLightCone } from "../../kit/equipment";

/**
 * Mushy Shroomy's Adventures — Elation. Elation is applied from catalog
 * properties.
 */
export default defineLightCone("21064", (k) => {
  const rumble = k.status({
    id: "mushy-shroomys-adventures-rumble",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(3) },
    modifiers: [
      { stat: "vulnerability", value: k.s(2), filter: { tags: ["elation"] } },
    ],
  });
  k.on(
    "actionStart",
    "lightCone",
    { abilityKinds: ["elationSkill"] },
    (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, rumble);
    }
  );
});
