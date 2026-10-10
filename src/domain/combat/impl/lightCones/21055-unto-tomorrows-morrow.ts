import { defineLightCone } from "../../kit/equipment";

/**
 * Unto Tomorrow's Morrow — Abundance. Outgoing Healing is applied from
 * catalog properties.
 */
export default defineLightCone("21055", (k) => {
  // HP is not simulated: allies are assumed at or above the HP threshold.
  const hpAbove = k.toggle(
    "hp-above",
    "lightCone",
    "selfHpAbove",
    true,
    k.s(2)
  );
  if (hpAbove) {
    k.teamStat("lightCone", { stat: "dmgBoost", value: k.s(3) }, "allies");
  }
});
