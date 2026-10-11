import { defineLightCone } from "../../kit/equipment";

/**
 * An Instant Before A Gaze — Erudition. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23018", (k) => {
  // Fixed by the wearer's max Energy, so it holds for every Ultimate.
  k.stat("lightCone", {
    stat: "dmgBoost",
    filter: { tags: ["ultimate"] },
    scaling: {
      source: "holder",
      stat: "maxEnergy",
      ratio: k.s(2),
      cap: k.s(2) * k.s(3),
    },
  });
});
