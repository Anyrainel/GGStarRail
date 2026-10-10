import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** A Grounded Ascent — Harmony. */
export default defineLightCone("23034", (k) => {
  const hymn = k.status({
    id: "a-grounded-ascent-hymn",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    maxStacks: k.s(3),
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const USES = "a-grounded-ascent-uses";
  const departingAnew = (ctx: BattleApi, target: UnitView) => {
    ctx.gainEnergy(ctx.self, k.s(1));
    ctx.applyStatus(target, hymn, { stacks: ctx.weight });
    ctx.addCounter(ctx.self, USES, 1);
    const uses = ctx.self.counter(USES);
    if (uses + 1e-9 >= k.s(5)) {
      ctx.setCounter(ctx.self, USES, uses - k.s(5));
      // "Recovers 1 Skill Point" has no placeholder.
      ctx.gainSkillPoints(1);
    }
  };
  const isAllyCharacter = (unit: UnitView | undefined): unit is UnitView =>
    unit !== undefined && !isEnemy(unit) && unit.kind === "character";

  // "On one ally character" (我方单体角色): a Skill or Ultimate aimed at one
  // ally, whose target is a Character.
  k.on(
    "actionEnd",
    "lightCone",
    {
      abilityKinds: ["skill", "ultimate"],
      when: (event) =>
        event.abilityTarget === "ally" && isAllyCharacter(event.target),
    },
    (ctx, event) => {
      if (isAllyCharacter(event.target)) departingAnew(ctx, event.target);
    }
  );
});
