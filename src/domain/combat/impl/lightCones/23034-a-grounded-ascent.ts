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

  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["skill"], when: (event) => isAllyCharacter(event.target) },
    (ctx, event) => {
      if (isAllyCharacter(event.target)) departingAnew(ctx, event.target);
    }
  );

  // Ultimates carry no ally target: the Ultimate is "on one ally character"
  // when the wearer's statuses from it reach exactly one other Character.
  let recipients: Set<UnitView> | null = null;
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, () => {
    recipients = new Set();
  });
  k.on("statusApplied", "lightCone", {}, (ctx, event) => {
    if (
      recipients &&
      isAllyCharacter(event.target) &&
      event.target !== ctx.self
    )
      recipients.add(event.target);
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    const targets = recipients ? [...recipients] : [];
    recipients = null;
    const [target] = targets;
    if (targets.length === 1 && target) departingAnew(ctx, target);
  });
});
