import { defineLightCone } from "../../kit/equipment";

/** Chorus — Harmony. */
export default defineLightCone("20005", (k) => {
  k.teamStat("lightCone", { stat: "atkPct", value: k.s(1) });
});
