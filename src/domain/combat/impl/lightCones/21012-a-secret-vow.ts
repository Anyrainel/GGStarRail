import { defineLightCone } from "../../kit/equipment";

/** A Secret Vow — Destruction. DMG dealt is applied from catalog properties. */
export default defineLightCone("21012", (k) => {
  // HP is not simulated: one assumption for every target that its HP
  // percentage is at least the wearer's.
  const higherHp = k.toggle("enemy-hp-higher", "lightCone", "active", true);
  if (higherHp) k.stat("lightCone", { stat: "dmgBoost", value: k.s(2) });
});
