import type { BattleApi } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/** Amphoreus, The Eternal Land. CRIT Rate is applied from catalog properties. */
export default defineRelicSet("323", {
  twoPiece: (k) => {
    const haste = k.status({
      id: "amphoreus-spd",
      origin: "ornament",
      unique: true,
      modifiers: [{ stat: "spdPct", value: k.param(2) }],
    });
    // "All allies" includes memosprites, which join the field over time.
    const sync = (ctx: BattleApi) => {
      const present = ctx.allies.some(
        (ally) => ally.kind === "memosprite" && ally.owner?.id === ctx.self.id
      );
      for (const ally of ctx.allies) {
        if (present && !ally.has(haste)) ctx.applyStatus(ally, haste);
        if (!present && ally.has(haste)) ctx.removeStatus(ally, haste);
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
