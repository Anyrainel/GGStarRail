import { defineLightCone } from "../../kit/equipment";

/** Carve the Moon, Weave the Clouds — Harmony. */
export default defineLightCone("21032", (k) => {
  // The first effect is uniform among three and each later one is uniform
  // among the other two, so every effect is active 1/3 of the time: the
  // expected values apply for the whole battle (U9). Removal when the
  // wearer is knocked down is not modelled.
  const share = 1 / 3;
  k.teamStat("lightCone", { stat: "atkPct", value: k.s(1) * share });
  k.teamStat("lightCone", { stat: "critDmg", value: k.s(2) * share });
  k.teamStat("lightCone", { stat: "energyRegen", value: k.s(3) * share });
});
