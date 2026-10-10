import { defineLightCone } from "../../kit/equipment";

/**
 * Summer Rides the Surf — Elation. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23064", (k) => {
  // Neither state has a duration in the text: both last for the battle.
  const updraft = k.status({
    id: "summer-rides-the-surf-updraft",
    origin: "lightCone",
    modifiers: [{ stat: "spdPct", value: k.s(2) }],
  });
  const uptrend = k.status({
    id: "summer-rides-the-surf-uptrend",
    origin: "lightCone",
    modifiers: [{ stat: "elation", value: k.s(3) }],
  });

  // Elation Skills are told apart by ability ID; the counter holds the
  // index of the last one (0 before the first, which has nothing to differ
  // from).
  const LAST = "summer-rides-the-surf-last";
  const USES = "summer-rides-the-surf-uses";
  const indices = new Map<string, number>();
  const indexOf = (abilityId: string) => {
    const known = indices.get(abilityId);
    if (known !== undefined) return known;
    const index = indices.size + 1;
    indices.set(abilityId, index);
    return index;
  };
  k.on(
    "actionStart",
    "lightCone",
    { abilityKinds: ["elationSkill"] },
    (ctx, event) => {
      ctx.applyStatus(ctx.self, updraft);
      const index = indexOf(event.abilityId ?? "elationSkill");
      const last = ctx.self.counter(LAST);
      if (last > 0 && Math.abs(last - index) > 1e-9) {
        ctx.applyStatus(ctx.self, uptrend);
      }
      ctx.setCounter(ctx.self, LAST, index);
    }
  );

  // "Recovers 1 Skill Point" has no placeholder. The battle is a single
  // wave.
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.gainSkillPoints(1)
  );
  k.on("actionEnd", "lightCone", { abilityKinds: ["elationSkill"] }, (ctx) => {
    ctx.addCounter(ctx.self, USES, 1);
    const uses = ctx.self.counter(USES);
    if (uses + 1e-9 >= k.s(4)) {
      ctx.setCounter(ctx.self, USES, uses - k.s(4));
      // One Skill Point per completed count, whatever the trigger's weight.
      ctx.gainSkillPoints(1 / ctx.weight);
    }
  });
});
