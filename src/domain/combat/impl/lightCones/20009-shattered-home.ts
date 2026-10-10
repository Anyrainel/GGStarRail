import { defineLightCone } from "../../kit/equipment";

/** Shattered Home — Destruction. */
export default defineLightCone("20009", (k) => {
  // Enemy HP is not simulated: one assumption for every target.
  const highHp = k.toggle(
    "enemy-hp-above",
    "lightCone",
    "enemyHpAbove",
    true,
    k.s(1)
  );
  if (highHp) k.stat("lightCone", { stat: "dmgBoost", value: k.s(2) });
});
