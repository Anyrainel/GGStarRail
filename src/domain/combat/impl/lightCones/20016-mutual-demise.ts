import { defineLightCone } from "../../kit/equipment";

/** Mutual Demise — Destruction. */
export default defineLightCone("20016", (k) => {
  // HP is not simulated.
  const lowHp = k.toggle(
    "self-hp-below",
    "lightCone",
    "selfHpBelow",
    false,
    k.s(1)
  );
  if (lowHp) k.stat("lightCone", { stat: "critRate", value: k.s(2) });
});
