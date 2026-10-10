import type { UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Ally targets: Characters and memosprites, not countdowns or summons. */
const isAllyTarget = (unit: UnitView) =>
  unit.kind === "character" || unit.kind === "memosprite";

/**
 * Night of Fright — Abundance. Energy Regeneration Rate is applied from
 * catalog properties.
 */
export default defineLightCone("23017", (k) => {
  const deepBreaths = k.status({
    id: "deep-deep-breaths",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    maxStacks: k.s(4),
    modifiers: [{ stat: "atkPct", value: k.s(3) }],
  });

  // "When any ally uses their Ultimate": the wearer heals the ally target
  // with the lowest HP percentage (the first in team order on a tie).
  k.on(
    "actionStart",
    "lightCone",
    { subject: "ally", abilityKinds: ["ultimate"] },
    (ctx) => {
      let lowest: UnitView | null = null;
      for (const ally of ctx.allies) {
        if (!isAllyTarget(ally)) continue;
        if (!lowest || ally.hpRatio < lowest.hpRatio - 1e-9) lowest = ally;
      }
      if (!lowest) return;
      ctx.heal(lowest, k.s(2) * (1 + ctx.self.currentStat("outgoingHealing")));
    }
  );

  // Every heal the wearer provides, this Light Cone's included.
  k.on(
    "hpChanged",
    "lightCone",
    {
      subject: "ally",
      when: (event, self) =>
        event.hpCause === "heal" &&
        event.source === self &&
        isAllyTarget(event.unit),
    },
    (ctx, event) =>
      ctx.applyStatus(event.unit, deepBreaths, { stacks: ctx.weight })
  );
});
