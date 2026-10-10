import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Shadowburn — Remembrance. */
export default defineLightCone("20021", (k) => {
  // There is no summon event (tracker shadowburn-summon-events): the
  // wearer's memosprite is looked for at battle start (Evey) and after
  // every action, so the first summon pays out at the end of the action
  // that summoned it.
  const SUMMONED = "lc20021:summoned";
  const check = (ctx: BattleApi) => {
    if (ctx.self.counter(SUMMONED) > 0) return;
    const summoned = ctx.allies.some(
      (unit) => unit.kind === "memosprite" && unit.owner === ctx.self
    );
    if (!summoned) return;
    ctx.setCounter(ctx.self, SUMMONED, 1);
    ctx.gainSkillPoints(k.s(1));
    ctx.gainEnergy(ctx.self, k.s(2));
  };
  k.on("battleStart", "lightCone", { subject: "any" }, check);
  k.on("actionEnd", "lightCone", { subject: "any" }, check);
});
