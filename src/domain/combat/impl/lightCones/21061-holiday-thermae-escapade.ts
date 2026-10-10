import { defineLightCone } from "../../kit/equipment";

/**
 * Holiday Thermae Escapade — Nihility. DMG Boost is applied from catalog
 * properties.
 */
export default defineLightCone("21061", (k) => {
  const vulnerability = k.status({
    id: "thermae-vulnerability",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "vulnerability", value: k.s(3) }],
  });
  k.on("actionEnd", "lightCone", { attack: true }, (ctx, event) => {
    for (const enemy of event.targetsHit ?? []) {
      ctx.applyStatus(enemy, vulnerability, { baseChance: k.s(2) });
    }
  });
});
