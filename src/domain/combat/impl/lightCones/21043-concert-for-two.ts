import { defineLightCone } from "../../kit/equipment";

/** Concert for Two — Preservation. DEF is applied from catalog properties. */
export default defineLightCone("21043", (k) => {
  // Shields are not simulated: by default every Character holds one, as
  // with the team-wide Shields of most Preservation Characters. Fu Xuan
  // provides none.
  const shielded = k.count(
    "shielded-characters",
    "lightCone",
    "stacks",
    k.wearer.characterId === "1208" ? 0 : k.team.length || 4,
    4
  );
  if (shielded > 0) {
    k.stat("lightCone", { stat: "dmgBoost", value: k.s(2) * shielded });
  }
});
