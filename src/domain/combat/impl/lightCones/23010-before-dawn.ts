import { defineLightCone } from "../../kit/equipment";

/** Before Dawn — Erudition. CRIT DMG is applied from catalog properties. */
export default defineLightCone("23010", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { tags: ["skill", "ultimate"] },
  });

  const somnusCorpus = k.status({
    id: "somnus-corpus",
    origin: "lightCone",
    modifiers: [
      { stat: "dmgBoost", value: k.s(3), filter: { tags: ["followUp"] } },
    ],
  });
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["skill", "ultimate"] },
    (ctx) => ctx.applyStatus(ctx.self, somnusCorpus)
  );
  // Consumed by the Follow-Up ATK it boosts: removed once that attack ends.
  // Summon follow-ups (Lightning-Lord) count as the wearer's.
  k.on("actionEnd", "lightCone", { abilityKinds: ["followUp"] }, (ctx) =>
    ctx.removeStatus(ctx.self, somnusCorpus)
  );
});
