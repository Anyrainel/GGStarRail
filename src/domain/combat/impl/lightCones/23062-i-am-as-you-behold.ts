import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * I Am As You Behold — Destruction. ATK and Energy Regeneration Rate are
 * applied from catalog properties.
 */
export default defineLightCone("23062", (k) => {
  // One stack per Energy the Ultimate consumed (none when paid from a
  // counter), up to #6 in total.
  const atWill = k.status({
    id: "at-will",
    origin: "lightCone",
    maxStacks: k.s(6) / k.s(3),
    modifiers: [
      { stat: "dmgBoost", value: k.s(3), filter: { tags: ["ultimate"] } },
    ],
  });
  const ultimate = { abilityKinds: ["ultimate"] } as const;
  k.on("actionStart", "lightCone", ultimate, (ctx, event) => {
    const spent = event.energySpent ?? 0;
    if (spent > 1e-9) ctx.applyStatus(ctx.self, atWill, { setStacks: spent });
  });
  k.on("actionEnd", "lightCone", ultimate, (ctx) =>
    ctx.removeStatus(ctx.self, atWill)
  );

  // King's Entertainment lasts for the wearer's turns while it buffs every
  // ally, so each ally's copy counts down on the wearer's clock.
  const kingsEntertainment = k.status({
    id: "kings-entertainment",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(4), clock: "applier" },
    modifiers: [{ stat: "critDmg", value: k.s(5) }],
  });
  const entertain = (ctx: BattleApi) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, kingsEntertainment);
  };
  k.on("battleStart", "lightCone", { subject: "any" }, entertain);
  k.on("actionStart", "lightCone", ultimate, entertain);
  // An aura of the wearer's state: a memosprite summoned while the wearer
  // holds it joins it, and every copy ends with the wearer's.
  k.on(
    "statusRemoved",
    "lightCone",
    {
      status: kingsEntertainment,
      when: (event, self) => event.target === self,
    },
    (ctx) => {
      for (const ally of ctx.allies) {
        if (ally !== ctx.self && ally.has(kingsEntertainment, ctx.self)) {
          ctx.removeStatus(ally, kingsEntertainment);
        }
      }
    }
  );
  k.on(
    "summoned",
    "lightCone",
    {
      subject: "ally",
      when: (event, self) =>
        event.unit.kind === "memosprite" && self.has(kingsEntertainment, self),
    },
    (ctx, event) => {
      const turns = ctx.self.remainingTurns(kingsEntertainment, ctx.self);
      if (turns) ctx.applyStatus(event.unit, kingsEntertainment, { turns });
    }
  );
});
