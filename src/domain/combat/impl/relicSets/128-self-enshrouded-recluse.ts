import type { BattleApi, UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

/** Self-Enshrouded Recluse. Shield Effect is not modelled (U12). */
export default defineRelicSet("128", {
  fourPiece: (k) => {
    // Held while the ally holds a Shield from the wearer; copies from two
    // wearers do not stack.
    const critDmg = k.status({
      id: "recluse-crit-dmg",
      origin: "relic4pc",
      modifiers: [{ stat: "critDmg", value: k.param(2) }],
      unique: true,
    });
    // Shield statuses the wearer has applied.
    const shields = new Set<StatusDef>();
    const shieldOf = (ally: UnitView, ctx: BattleApi) =>
      Math.min(
        1,
        Math.max(0, ...[...shields].map((def) => ally.stacks(def, ctx.self)))
      );
    const isShield = (event: { status?: StatusDef; target?: UnitView }) =>
      event.status?.family === "shield" &&
      event.target !== undefined &&
      event.target.kind !== "enemy";
    k.on("statusApplied", "relic4pc", { when: isShield }, (ctx, event) => {
      if (!event.status || !event.target) return;
      shields.add(event.status);
      ctx.applyStatus(event.target, critDmg, {
        setStacks: shieldOf(event.target, ctx),
      });
    });
    k.on("statusRemoved", "relic4pc", { when: isShield }, (ctx, event) => {
      if (!event.target) return;
      const held = shieldOf(event.target, ctx);
      if (held > 0) {
        ctx.setStatusStacks(event.target, critDmg, held);
      } else {
        ctx.removeStatus(event.target, critDmg);
      }
    });
  },
});
