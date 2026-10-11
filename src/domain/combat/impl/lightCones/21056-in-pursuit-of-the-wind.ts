import { defineLightCone } from "../../kit/equipment";

/** In Pursuit of the Wind — Harmony. */
export default defineLightCone("21056", (k) => {
  // "Abilities of the same type cannot stack": the engine keeps the
  // strongest copy of an equipment aura.
  k.teamStat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { tags: ["break"] },
  });
});
