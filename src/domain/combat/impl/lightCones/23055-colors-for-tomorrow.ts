import { defineLightCone } from "../../kit/equipment";

/** Colors for Tomorrow — Elation. DEF is applied from catalog properties. */
export default defineLightCone("23055", (k) => {
  const inkSplash = k.status({
    id: "colors-for-tomorrow-ink-splash",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "vulnerability", value: k.s(4) }],
  });

  // "On all allies" (对我方全体): an Elation Skill aimed at all allies.
  k.on(
    "actionStart",
    "lightCone",
    {
      abilityKinds: ["elationSkill"],
      when: (event) => event.abilityTarget === "allies",
    },
    (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, inkSplash);
      ctx.gainEnergy(ctx.self, k.s(2), { fixed: true });
      const amount =
        k.s(5) *
        ctx.self.currentStat("def") *
        (1 + ctx.self.currentStat("outgoingHealing"));
      for (const ally of ctx.allies) {
        const maxHp = ally.currentStat("hp");
        if (maxHp > 0) ctx.heal(ally, amount / maxHp);
      }
    }
  );
});
