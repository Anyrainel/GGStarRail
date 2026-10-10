import { defineLightCone } from "../../kit/equipment";

/**
 * Into the Unreachable Veil — Erudition. CRIT Rate is applied from catalog
 * properties. #2 is not referenced by the text.
 */
export default defineLightCone("23037", (k) => {
  const mindGame = k.status({
    id: "mind-game",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.s(4),
        filter: { tags: ["skill", "ultimate"] },
      },
    ],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, mindGame)
  );

  // Ultimate events do not carry the Energy consumed: read as the wearer's
  // max Energy, the default Ultimate cost. "Recovers 1 Skill Point" has no
  // placeholder. Tracker: into-the-unreachable-veil-energy-cost.
  if (k.wearer.maxEnergy >= k.s(3)) {
    k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
      ctx.gainSkillPoints(1)
    );
  }
});
