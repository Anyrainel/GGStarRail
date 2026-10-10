import type { BattleApi, BattleEvent } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Concert for Two — Preservation. DEF is applied from catalog properties. */
export default defineLightCone("21043", (k) => {
  // One stack per on-field Character holding a Shield (any source).
  const inspire = k.status({
    id: "concert-for-two-inspire",
    origin: "lightCone",
    maxStacks: 4,
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const sync = (ctx: BattleApi) => {
    const shielded = ctx.allies.filter(
      (ally) =>
        ally.kind === "character" && !ally.departed && ally.hasFamily("shield")
    ).length;
    const held = ctx.self.stacks(inspire, ctx.self);
    if (shielded === held) return;
    if (shielded === 0) ctx.removeStatus(ctx.self, inspire);
    else if (held === 0) {
      ctx.applyStatus(ctx.self, inspire, { setStacks: shielded });
    } else ctx.setStatusStacks(ctx.self, inspire, shielded);
  };
  const shieldChange = {
    subject: "any",
    when: (event: BattleEvent) => event.status?.family === "shield",
  } as const;
  k.on("statusApplied", "lightCone", shieldChange, sync);
  k.on("statusRemoved", "lightCone", shieldChange, sync);
  // Leaving the field has no event: recount when the wearer acts.
  k.on("actionStart", "lightCone", {}, sync);
});
