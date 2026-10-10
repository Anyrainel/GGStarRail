import type { BattleApi, UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/** Punklorde Stage Zero. Elation is applied from catalog properties. */
export default defineRelicSet("325", {
  twoPiece: (k) => {
    // Tiers: 20% at 40% Elation, 32% in total at 80%. Each is kept for the
    // rest of the battle once the wearer's Elation with its current statuses
    // reaches it.
    const tiers = [
      {
        threshold: k.param(2),
        status: k.status({
          id: "punklorde-first-tier",
          origin: "ornament",
          modifiers: [{ stat: "critDmg", value: k.param(4) }],
        }),
      },
      {
        threshold: k.param(3),
        status: k.status({
          id: "punklorde-second-tier",
          origin: "ornament",
          modifiers: [{ stat: "critDmg", value: k.param(5) - k.param(4) }],
        }),
      },
    ];
    // Memosprites inherit the wearer's equipment bonuses (the engine copies
    // permanent ones), so the latched tiers reach them too.
    const holders = (ctx: BattleApi): UnitView[] => [
      ctx.self,
      ...ctx.allies.filter(
        (ally) => ally.kind === "memosprite" && ally.owner?.id === ctx.self.id
      ),
    ];
    const latch = (ctx: BattleApi) => {
      const elation = ctx.self.currentStat("elation");
      for (const { threshold, status } of tiers) {
        if (ctx.self.has(status) || elation + 1e-9 < threshold) continue;
        for (const unit of holders(ctx)) ctx.applyStatus(unit, status);
      }
    };
    const open = (self: UnitView) =>
      tiers.some(({ status }) => !self.has(status));
    k.on("battleStart", "ornament", { subject: "any" }, latch);
    k.on(
      "statusApplied",
      "ornament",
      {
        subject: "any",
        when: (event, self) => event.target?.id === self.id && open(self),
      },
      latch
    );
    k.on(
      "actionStart",
      "ornament",
      { when: (_event, self) => open(self) },
      latch
    );
    k.on("summoned", "ornament", { subject: "memosprite" }, (ctx, event) => {
      for (const { status } of tiers) {
        if (ctx.self.has(status)) ctx.applyStatus(event.unit, status);
      }
    });
  },
});
