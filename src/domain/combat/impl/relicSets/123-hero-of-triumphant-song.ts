import type { BattleApi, UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

function memospritesOf(ctx: BattleApi): UnitView[] {
  return ctx.allies.filter(
    (unit) => unit.kind === "memosprite" && unit.owner?.id === ctx.self.id
  );
}

/** Hero of Triumphant Song. ATK is applied from catalog properties. */
export default defineRelicSet("123", {
  fourPiece: (k) => {
    const spd = k.status({
      id: "hero-spd",
      origin: "relic4pc",
      modifiers: [{ stat: "spdPct", value: k.param(1) }],
    });
    const critDmg = k.status({
      id: "hero-crit-dmg",
      origin: "relic4pc",
      duration: { turns: k.param(3) },
      modifiers: [{ stat: "critDmg", value: k.param(2) }],
    });

    // There is no summon or dismissal event: the SPD follows the
    // memosprite's presence around every action and turn.
    const syncSpd = (ctx: BattleApi) => {
      const present = memospritesOf(ctx).length > 0;
      if (present && !ctx.self.has(spd)) ctx.applyStatus(ctx.self, spd);
      else if (!present && ctx.self.has(spd)) ctx.removeStatus(ctx.self, spd);
    };
    for (const event of [
      "battleStart",
      "turnStart",
      "actionStart",
      "actionEnd",
      "turnEnd",
    ] as const) {
      k.on(event, "relic4pc", { subject: "any" }, syncSpd);
    }

    k.on(
      "actionStart",
      "relic4pc",
      { subject: "memosprite", attack: true },
      (ctx) => {
        for (const unit of [ctx.self, ...memospritesOf(ctx)]) {
          ctx.applyStatus(unit, critDmg);
        }
      }
    );
  },
});
