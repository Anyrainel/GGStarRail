import { defineLightCone } from "../../kit/equipment";

/**
 * Baptism of Pure Thought — The Hunt. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23020", (k) => {
  // One stack per debuff on the target, up to the cap.
  for (let debuffs = 1; debuffs <= k.s(3); debuffs += 1) {
    k.stat("lightCone", {
      stat: "critDmg",
      value: k.s(2),
      filter: { minTargetDebuffs: debuffs },
    });
  }

  const disputation = k.status({
    id: "disputation",
    origin: "lightCone",
    duration: { turns: k.s(6) },
    modifiers: [
      { stat: "dmgBoost", value: k.s(4) },
      { stat: "defIgnore", value: k.s(5), filter: { tags: ["followUp"] } },
    ],
  });
  // Gained when the Ultimate is used, so the Ultimate itself benefits.
  k.on(
    "actionStart",
    "lightCone",
    { abilityKinds: ["ultimate"], attack: true },
    (ctx) => ctx.applyStatus(ctx.self, disputation)
  );
});
