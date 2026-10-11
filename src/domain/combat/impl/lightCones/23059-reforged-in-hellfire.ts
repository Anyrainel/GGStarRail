import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

const ENERGY_USED = "reforged-in-hellfire:energy";

/**
 * Reforged in Hellfire — Nihility. Max HP is applied from catalog
 * properties.
 */
export default defineLightCone("23059", (k) => {
  // Once per wave; battles have a single wave.
  k.on(
    "turnStart",
    "lightCone",
    { when: (_event, self) => self.counter(ENERGY_USED) <= 0 },
    (ctx) => {
      ctx.setCounter(ctx.self, ENERGY_USED, 1);
      ctx.gainEnergy(ctx.self, k.s(2), { fixed: true });
    }
  );

  const purgatory = k.status({
    id: "purgatory",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(3) },
  });
  // CRIT DMG received: every ally hitting the target, plus the wearer's own.
  k.teamStat("lightCone", {
    stat: "critDmg",
    value: k.s(4),
    filter: { targetStatuses: [purgatory.id] },
  });
  k.stat("lightCone", {
    stat: "critDmg",
    value: k.s(5),
    filter: { targetStatuses: [purgatory.id] },
  });
  // Skill uses, including those "considered as" another type that keep the
  // Skill tag. Every enemy the Skill hit is "the target".
  k.on(
    "actionEnd",
    "lightCone",
    {
      attack: true,
      when: (event) =>
        event.abilityKind === "skill" || (event.tags ?? []).includes("skill"),
    },
    (ctx, event) => {
      for (const target of event.targetsHit ?? []) {
        if (isEnemy(target)) ctx.applyStatus(target, purgatory);
      }
    }
  );
});
