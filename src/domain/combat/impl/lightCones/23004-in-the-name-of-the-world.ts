import { defineLightCone } from "../../kit/equipment";

/** In the Name of the World — Nihility. */
export default defineLightCone("23004", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { minTargetDebuffs: 1 },
  });

  // "For this attack": held for the whole Skill action, so debuffs and
  // detonations inside it see it too. Landing chances read the steady
  // panel, so the Effect Hit Rate part has no effect yet (tracked).
  const skillBoost = k.status({
    id: "in-the-name-of-the-world",
    origin: "lightCone",
    modifiers: [
      { stat: "effectHitRate", value: k.s(2) },
      { stat: "atkPct", value: k.s(3) },
    ],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["skill"] }, (ctx) =>
    ctx.applyStatus(ctx.self, skillBoost)
  );
  k.on("actionEnd", "lightCone", { abilityKinds: ["skill"] }, (ctx) =>
    ctx.removeStatus(ctx.self, skillBoost)
  );
});
