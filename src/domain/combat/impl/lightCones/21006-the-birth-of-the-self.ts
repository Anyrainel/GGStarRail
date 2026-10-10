import { defineLightCone } from "../../kit/equipment";

/** The Birth of the Self — Erudition. */
export default defineLightCone("21006", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { tags: ["followUp"] },
  });
  // Enemy HP is not simulated: one assumption for every target.
  const lowHp = k.toggle(
    "enemy-hp-below",
    "lightCone",
    "enemyHpBelow",
    true,
    k.s(2)
  );
  if (lowHp) {
    k.stat("lightCone", {
      stat: "dmgBoost",
      value: k.s(3),
      filter: { tags: ["followUp"] },
    });
  }
});
