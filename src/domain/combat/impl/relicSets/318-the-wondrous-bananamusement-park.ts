import type { BattleApi, UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

/**
 * Action Order countdowns and markers (Concerto, Supreme Stance) are not
 * summoned targets. The ID suffix covers countdown kits not yet declared
 * with `countdown: true` (bananamusement-countdown-flag).
 */
function summonedTarget(unit: UnitView): boolean {
  return (
    unit.kind === "memosprite" ||
    (unit.kind === "summon" &&
      !unit.countdown &&
      !unit.definitionId.endsWith("-countdown"))
  );
}

/**
 * The Wondrous BananAmusement Park. CRIT DMG is applied from catalog
 * properties.
 */
export default defineRelicSet("318", {
  twoPiece: (k) => {
    const summoned = k.status({
      id: "bananamusement-crit-dmg",
      origin: "ornament",
      modifiers: [{ stat: "critDmg", value: k.param(2) }],
    });
    // The wearer's summoned targets on the field, by unit ID.
    const active = new Set<string>();
    // Memosprites inherit the wearer's equipment bonuses (the engine copies
    // them), so the conditional CRIT DMG follows the same rule.
    const sync = (ctx: BattleApi) => {
      const present = active.size > 0;
      const memosprites = ctx.allies.filter(
        (ally) => ally.kind === "memosprite" && ally.owner?.id === ctx.self.id
      );
      for (const unit of [ctx.self, ...memosprites]) {
        if (present && !unit.has(summoned)) ctx.applyStatus(unit, summoned);
        if (!present && unit.has(summoned)) ctx.removeStatus(unit, summoned);
      }
    };
    const filter = {
      subject: "selfOrMemosprite" as const,
      when: (event: { unit: UnitView }) => summonedTarget(event.unit),
    };
    k.on("summoned", "ornament", filter, (ctx, event) => {
      active.add(event.unit.id);
      sync(ctx);
    });
    k.on("departed", "ornament", filter, (ctx, event) => {
      active.delete(event.unit.id);
      sync(ctx);
    });
  },
});
