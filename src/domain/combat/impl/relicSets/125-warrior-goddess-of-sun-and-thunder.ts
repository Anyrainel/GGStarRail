import type { UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/** Warrior Goddess of Sun and Thunder. SPD is applied from catalog properties. */
export default defineRelicSet("125", {
  fourPiece: (k) => {
    const gentleRain = k.status({
      id: "warrior-goddess-gentle-rain",
      origin: "relic4pc",
      duration: { turns: k.param(3) },
      modifiers: [{ stat: "spdPct", value: k.param(1) }],
    });
    // Held while the wearer has Gentle Rain; copies from two wearers do not
    // stack.
    const critDmg = k.status({
      id: "warrior-goddess-crit-dmg",
      origin: "relic4pc",
      modifiers: [{ stat: "critDmg", value: k.param(2) }],
      unique: true,
    });
    const ownUnit = (unit: UnitView | undefined, self: UnitView) =>
      unit !== undefined && (unit.id === self.id || unit.owner?.id === self.id);
    // ZH: heals by the wearer or its memosprite on allies other than the
    // wearer and its memosprite (装备者及其忆灵以外的我方目标).
    k.on(
      "hpChanged",
      "relic4pc",
      {
        subject: "ally",
        limitPerTurn: 1,
        when: (event, self) =>
          event.hpCause === "heal" &&
          ownUnit(event.source, self) &&
          !ownUnit(event.unit, self),
      },
      (ctx) => {
        ctx.applyStatus(ctx.self, gentleRain, { stacks: ctx.weight });
        for (const ally of ctx.allies) {
          ctx.applyStatus(ally, critDmg, { stacks: ctx.weight });
        }
      }
    );
    k.on("statusRemoved", "relic4pc", { status: gentleRain }, (ctx) => {
      for (const ally of ctx.allies) ctx.removeStatus(ally, critDmg);
    });
  },
});
