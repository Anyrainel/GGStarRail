import type { UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

const SPENT = "never-forget-her-flame:spent";

/**
 * Never Forget Her Flame — Nihility. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("23050", (k) => {
  const immolation = k.status({
    id: "never-forget-her-flame",
    origin: "lightCone",
    unique: true,
    modifiers: [
      { stat: "dmgBoost", value: k.s(2), filter: { tags: ["break"] } },
    ],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    ctx.applyStatus(ctx.self, immolation);
    // The teammate who triggered combat is unknown: use the fallback, the
    // teammate with the highest Break Effect (team order breaks ties).
    let partner: UnitView | null = null;
    for (const ally of ctx.allies) {
      if (ally.kind !== "character" || ally === ctx.self) continue;
      if (
        !partner ||
        ally.panelStat("breakEffect") > partner.panelStat("breakEffect") + 1e-9
      ) {
        partner = ally;
      }
    }
    if (partner) ctx.applyStatus(partner, immolation);
  });

  // "Recovers 1 Skill Point" has no placeholder. The engine reports only
  // Weaknesses the enemy did not have, so refreshing an implant is missed.
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.setCounter(ctx.self, SPENT, 0)
  );
  k.on(
    "weaknessImplanted",
    "lightCone",
    { when: (_event, self) => self.counter(SPENT) <= 0 },
    (ctx) => {
      ctx.setCounter(ctx.self, SPENT, 1);
      ctx.gainSkillPoints(1);
    }
  );
});
