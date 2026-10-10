import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Reminiscence — Remembrance. */
export default defineLightCone("20022", (k) => {
  const commemoration = k.status({
    id: "reminiscence-commemoration",
    origin: "lightCone",
    maxStacks: k.s(2),
    modifiers: [{ stat: "dmgBoost", value: k.s(1) }],
  });
  k.on("turnStart", "lightCone", { subject: "memosprite" }, (ctx, event) => {
    ctx.applyStatus(ctx.self, commemoration);
    ctx.applyStatus(event.unit, commemoration);
  });
  // A memosprite that disappears takes its own stacks with it (it returns
  // as a new unit). There is no dismissal event, so the wearer's stacks are
  // removed at the next turn or action boundary without a memosprite.
  const clear = (ctx: BattleApi) => {
    if (!ctx.self.has(commemoration)) return;
    const present = ctx.allies.some(
      (unit) => unit.kind === "memosprite" && unit.owner === ctx.self
    );
    if (!present) ctx.removeStatus(ctx.self, commemoration);
  };
  for (const event of [
    "turnStart",
    "turnEnd",
    "actionStart",
    "actionEnd",
  ] as const) {
    k.on(event, "lightCone", { subject: "any" }, clear);
  }
});
