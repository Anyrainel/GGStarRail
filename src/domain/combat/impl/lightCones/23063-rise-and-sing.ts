import { defineLightCone } from "../../kit/equipment";

/** Rise and Sing — Remembrance. Max HP is applied from catalog properties. */
export default defineLightCone("23063", (k) => {
  // "Recovers 1 Skill Point" has no placeholder.
  const skillPoints = 1;
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.gainSkillPoints(skillPoints)
  );

  // New Melody's SPD aura, held by every ally on the wearer's clock so it
  // ends with New Melody. Memosprites ignore SPD% statuses
  // (engine-memosprite-spd-pct).
  const newMelodySpd = k.status({
    id: "rise-and-sing-new-melody-spd",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(4), clock: "applier" },
    modifiers: [{ stat: "spdPct", value: k.s(3) }],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    ctx.advanceAction(ctx.self, k.s(2));
    for (const ally of ctx.allies) ctx.applyStatus(ally, newMelodySpd);
  });
});
