import { defineLightCone } from "../../kit/equipment";

/**
 * But the Battle Isn't Over — Harmony. Energy Regeneration Rate is applied
 * from catalog properties.
 */
export default defineLightCone("23003", (k) => {
  // "1 Skill Point" and "once after every 2 uses" have no placeholders. The
  // first Ultimate triggers it, then every second one.
  const ULTIMATE_COOLDOWN = "but-the-battle-isnt-over-cooldown";
  const usesPerTrigger = 2;
  // An Ultimate "on an ally" is one that does not attack enemies.
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["ultimate"] },
    (ctx, event) => {
      if (!event.attack && ctx.self.counter(ULTIMATE_COOLDOWN) <= 1e-9) {
        ctx.gainSkillPoints(1);
        ctx.setCounter(ctx.self, ULTIMATE_COOLDOWN, usesPerTrigger);
      }
      ctx.addCounter(ctx.self, ULTIMATE_COOLDOWN, -1);
    }
  );

  const heir = k.status({
    id: "but-the-battle-isnt-over",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const PENDING = "but-the-battle-isnt-over-pending";
  const TURNS = "but-the-battle-isnt-over-turns";
  k.on("actionStart", "lightCone", { abilityKinds: ["skill"] }, (ctx) =>
    ctx.setCounter(ctx.self, PENDING, 1)
  );
  // The next teammate turn (memosprites included, stat-less summons not)
  // receives the buff for #3 of its own turns, counting this one.
  k.on(
    "turnStart",
    "lightCone",
    {
      subject: "otherAlly",
      when: (event, self) =>
        self.counter(PENDING) > 0 &&
        (event.unit.kind === "character" || event.unit.kind === "memosprite"),
    },
    (ctx, event) => {
      ctx.setCounter(ctx.self, PENDING, 0);
      ctx.applyStatus(event.unit, heir);
      ctx.setCounter(event.unit, TURNS, 0);
    }
  );
  k.on(
    "turnEnd",
    "lightCone",
    {
      subject: "otherAlly",
      when: (event, self) => event.unit.has(heir, self),
    },
    (ctx, event) => {
      ctx.addCounter(event.unit, TURNS, 1);
      if (event.unit.counter(TURNS) + 1e-9 >= k.s(3)) {
        ctx.removeStatus(event.unit, heir);
      }
    }
  );
});
