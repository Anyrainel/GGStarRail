import { defineLightCone } from "../../kit/equipment";

/** Boundless Choreo — Nihility. CRIT Rate is applied from catalog properties. */
export default defineLightCone("21044", (k) => {
  // The engine cannot tell whether a target's DEF is reduced, so that half is
  // a toggle that covers every target; Slow is read from the target.
  const defReduced = k.toggle("def-reduced", "lightCone", "active", true);
  k.stat("lightCone", {
    stat: "critDmg",
    value: k.s(2),
    filter: defReduced ? undefined : { targetFamilies: ["slow"] },
  });
});
