import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * The Hell Where Ideals Burn — The Hunt. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23046", (k) => {
  const hrunting = k.status({
    id: "hrunting",
    origin: "lightCone",
    modifiers: [{ stat: "atkPct", value: k.s(3) }],
  });
  const skillStacks = k.status({
    id: "hrunting-skill",
    origin: "lightCone",
    maxStacks: k.s(5),
    modifiers: [{ stat: "atkPct", value: k.s(4) }],
  });

  const checkLimit = (ctx: BattleApi) => {
    if (ctx.maxSkillPoints >= k.s(2) - 1e-9) {
      ctx.applyStatus(ctx.self, hrunting);
    }
  };
  // Battle-start listeners run slot by slot, so a teammate later in the team
  // may raise the Skill Point limit after this check: repeat it once before
  // the first turn of the battle.
  const checked = "the-hell-where-ideals-burn:checked";
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    checkLimit(ctx)
  );
  k.on(
    "turnStart",
    "lightCone",
    { subject: "any", when: (_, self) => self.counter(checked) === 0 },
    (ctx) => {
      ctx.setCounter(ctx.self, checked, 1);
      checkLimit(ctx);
    }
  );

  k.on("actionEnd", "lightCone", { abilityKinds: ["skill"] }, (ctx) =>
    ctx.applyStatus(ctx.self, skillStacks, { stacks: ctx.weight })
  );
});
