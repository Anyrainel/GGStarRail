import { defineLightCone } from "../../kit/equipment";

/** Amber — Preservation. DEF is applied from catalog properties. */
export default defineLightCone("20003", (k) => {
  // HP is not simulated.
  const lowHp = k.toggle(
    "self-hp-below",
    "lightCone",
    "selfHpBelow",
    false,
    k.s(2)
  );
  if (lowHp) k.stat("lightCone", { stat: "defPct", value: k.s(3) });
});
