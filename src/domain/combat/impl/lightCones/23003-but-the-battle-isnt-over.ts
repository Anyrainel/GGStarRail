import type { UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * But the Battle Isn't Over — Harmony. Energy Regeneration Rate is applied
 * from catalog properties.
 */
export default defineLightCone("23003", (k) => {
  // "1 Skill Point" and "once after every 2 uses" have no placeholders. The
  // first Ultimate triggers it, then every second one (every Ultimate counts
  // toward the 2 uses).
  const ULTIMATE_COOLDOWN = "but-the-battle-isnt-over-cooldown";
  const usesPerTrigger = 2;
  // "On an ally" (对我方目标): an Ultimate aimed at one ally, all allies, or
  // the wearer.
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["ultimate"] },
    (ctx, event) => {
      const onAlly =
        event.abilityTarget === "ally" ||
        event.abilityTarget === "allies" ||
        event.abilityTarget === "self";
      if (onAlly && ctx.self.counter(ULTIMATE_COOLDOWN) <= 1e-9) {
        ctx.gainSkillPoints(1);
        ctx.setCounter(ctx.self, ULTIMATE_COOLDOWN, usesPerTrigger);
      }
      ctx.addCounter(ctx.self, ULTIMATE_COOLDOWN, -1);
    }
  );

  // Copies from several wearers do not stack, like equipment team auras.
  const heir = k.status({
    id: "but-the-battle-isnt-over",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
    unique: true,
  });
  // The next ally is read from the Action Order after the Skill resolves
  // (as Past and Future), so an ally the Skill advanced receives it.
  k.on("actionEnd", "lightCone", { abilityKinds: ["skill"] }, (ctx) => {
    let next: UnitView | null = null;
    for (const ally of ctx.allies) {
      if (ally === ctx.self || !ally.inActionOrder) continue;
      if (
        !next ||
        ally.actionGauge / ally.speed < next.actionGauge / next.speed - 1e-9
      ) {
        next = ally;
      }
    }
    if (next) ctx.applyStatus(next, heir);
  });
});
