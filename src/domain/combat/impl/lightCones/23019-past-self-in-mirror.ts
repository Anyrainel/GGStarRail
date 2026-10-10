import { defineLightCone } from "../../kit/equipment";

/** Past Self in Mirror — Harmony. Break Effect is applied from catalog properties. */
export default defineLightCone("23019", (k) => {
  const plumFragrance = k.status({
    id: "past-self-in-mirror",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    unique: true,
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, plumFragrance);
    // "1 Skill Point" has no placeholder.
    if (ctx.self.panelStat("breakEffect") + 1e-9 >= k.s(4)) {
      ctx.gainSkillPoints(1);
    }
  });

  // The battle is a single wave. "Cannot stack": a second wearer only adds
  // what exceeds the Energy already granted (tracked on the first ally).
  const GRANTED = "past-self-in-mirror-wave-energy";
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    const ledger = ctx.allies[0];
    if (!ledger) return;
    const extra = k.s(5) - ledger.counter(GRANTED);
    if (extra <= 0) return;
    ctx.setCounter(ledger, GRANTED, k.s(5));
    for (const ally of ctx.allies) {
      if (ally.kind === "character") ctx.gainEnergy(ally, extra);
    }
  });
});
