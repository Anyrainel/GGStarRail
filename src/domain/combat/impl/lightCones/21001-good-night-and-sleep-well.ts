import { defineLightCone } from "../../kit/equipment";

/** Good Night and Sleep Well — Nihility. */
export default defineLightCone("21001", (k) => {
  // One stack per debuff on the target, up to the cap. Unfiltered by tag, so
  // it reaches the wearer's DoTs too.
  for (let debuffs = 1; debuffs <= k.s(2); debuffs += 1) {
    k.stat("lightCone", {
      stat: "dmgBoost",
      value: k.s(1),
      filter: { minTargetDebuffs: debuffs },
    });
  }
});
