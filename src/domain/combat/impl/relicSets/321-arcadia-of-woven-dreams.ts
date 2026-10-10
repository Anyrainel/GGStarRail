import type { BattleApi, UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

/** "When the number of ally targets on the field is not equal to 4". */
const FULL_TEAM = 4;

/** Arcadia of Woven Dreams. */
export default defineRelicSet("321", {
  twoPiece: (k) => {
    const additional = k.status({
      id: "arcadia-additional-allies",
      origin: "ornament",
      maxStacks: k.param(3),
      modifiers: [{ stat: "dmgBoost", value: k.param(1) }],
    });
    const missing = k.status({
      id: "arcadia-missing-allies",
      origin: "ornament",
      maxStacks: k.param(4),
      modifiers: [{ stat: "dmgBoost", value: k.param(2) }],
    });
    const setStacks = (
      ctx: BattleApi,
      unit: UnitView,
      status: StatusDef,
      stacks: number
    ) => {
      const current = unit.stacks(status);
      if (current === Math.min(stacks, status.maxStacks ?? 1)) return;
      if (stacks <= 0) ctx.removeStatus(unit, status);
      else if (current > 0) ctx.setStatusStacks(unit, status, stacks);
      else ctx.applyStatus(unit, status, { stacks });
    };
    // Ally targets on the field: Characters and memosprites (summons such as
    // Numby are not targets). The wearer's memosprites share the bonus.
    const sync = (ctx: BattleApi) => {
      const targets = ctx.allies.length;
      const holders = ctx.allies.filter(
        (ally) =>
          ally.id === ctx.self.id ||
          (ally.kind === "memosprite" && ally.owner?.id === ctx.self.id)
      );
      for (const unit of holders) {
        setStacks(ctx, unit, additional, Math.max(0, targets - FULL_TEAM));
        setStacks(ctx, unit, missing, Math.max(0, FULL_TEAM - targets));
      }
    };
    for (const event of [
      "battleStart",
      "turnStart",
      "actionStart",
      "actionEnd",
    ] as const) {
      k.on(event, "ornament", { subject: "any" }, sync);
    }
  },
});
