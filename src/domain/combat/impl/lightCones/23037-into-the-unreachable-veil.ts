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

  // "Recovers 1 Skill Point" has no placeholder. Ultimates paid from a
  // counter consume no Energy.
  k.on(
    "actionEnd",
    "lightCone",
    {
      abilityKinds: ["ultimate"],
      when: (event) => (event.energySpent ?? 0) + 1e-9 >= k.s(3),
    },
    (ctx) => ctx.gainSkillPoints(1)
  );
});
