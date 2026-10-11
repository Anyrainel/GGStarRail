import { defineLightCone } from "../../kit/equipment";

/**
 * The Seriousness of Breakfast — Erudition. DMG dealt is applied from
 * catalog properties.
 */
export default defineLightCone("21027", (k) => {
  // Kills are not simulated: the stacks are the enemies the wearer has
  // already defeated earlier in the battle (e.g. in previous waves).
  const defeated = k.count("defeated", "lightCone", "enemyDefeated", 0, k.s(3));
  if (defeated > 0) {
    k.stat("lightCone", { stat: "atkPct", value: k.s(2) * defeated });
  }
});
