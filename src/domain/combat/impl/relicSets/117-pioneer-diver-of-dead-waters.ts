import { isEnemy } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";
import type { ModifierDef } from "../../kit/model";

/**
 * Pioneer Diver of Dead Waters. The 4-piece CRIT Rate is applied from
 * catalog properties.
 */
export default defineRelicSet("117", {
  twoPiece: (k) => {
    k.stat("relic2pc", {
      stat: "dmgBoost",
      value: k.param(1),
      filter: { minTargetDebuffs: 1 },
    });
  },
  fourPiece: (k) => {
    // #2 at #4 debuffs, #3 in total at #5.
    const critDmg: readonly ModifierDef[] = [
      {
        stat: "critDmg",
        value: k.param(2),
        filter: { minTargetDebuffs: k.param(4) },
      },
      {
        stat: "critDmg",
        value: k.param(3) - k.param(2),
        filter: { minTargetDebuffs: k.param(5) },
      },
    ];
    for (const modifier of critDmg) k.stat("relic4pc", modifier);
    // "The aforementioned effects increase by 100%": a second copy of the
    // CRIT Rate and both CRIT DMG tiers.
    const doubled = k.status({
      id: "pioneer-doubled",
      origin: "relic4pc",
      duration: { turns: k.param(6) },
      modifiers: [{ stat: "critRate", value: k.param(1) }, ...critDmg],
    });
    k.on(
      "statusApplied",
      "relic4pc",
      {
        when: (event) => event.status?.debuff === true && isEnemy(event.target),
      },
      (ctx) => ctx.applyStatus(ctx.self, doubled)
    );
  },
});
