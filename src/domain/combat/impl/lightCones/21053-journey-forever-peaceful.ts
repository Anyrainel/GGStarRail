import { defineLightCone } from "../../kit/equipment";

/** Journey, Forever Peaceful — Preservation. */
export default defineLightCone("21053", (k) => {
  // Shields (and the Shield Effect bonus) are not simulated: on by default,
  // every ally holds a Shield for the whole battle. Fu Xuan provides none.
  const shielded = k.toggle(
    "allies-shielded",
    "lightCone",
    "active",
    k.wearer.characterId !== "1208"
  );
  if (shielded) k.teamStat("lightCone", { stat: "dmgBoost", value: k.s(2) });
});
