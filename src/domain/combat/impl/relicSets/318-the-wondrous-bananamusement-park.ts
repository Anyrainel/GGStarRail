import type { BattleApi, UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

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
    // Summons (kind "summon") cannot be told apart from countdowns, which
    // never attack: a summon counts once it has attacked and while it is
    // still active (Numby, Lightning-Lord). Memosprites count while present.
    const attackingSummons = new Set<string>();
    const memospritesOf = (ctx: BattleApi): UnitView[] =>
      ctx.allies.filter(
        (ally) => ally.kind === "memosprite" && ally.owner?.id === ctx.self.id
      );
    // Memosprites inherit the wearer's equipment bonuses (the engine copies
    // them), so the conditional CRIT DMG follows the same rule.
    const sync = (ctx: BattleApi) => {
      const memosprites = memospritesOf(ctx);
      const present =
        memosprites.length > 0 ||
        [...attackingSummons].some(
          (id) => ctx.findSummon(ctx.self, id) !== null
        );
      for (const unit of [ctx.self, ...memosprites]) {
        if (present && !unit.has(summoned)) ctx.applyStatus(unit, summoned);
        if (!present && unit.has(summoned)) ctx.removeStatus(unit, summoned);
      }
    };
    k.on("battleStart", "ornament", { subject: "any" }, (ctx) => {
      attackingSummons.clear();
      sync(ctx);
    });
    k.on(
      "actionStart",
      "ornament",
      {
        subject: "self",
        attack: true,
        when: (event, self) =>
          event.unit.kind === "summon" && event.unit.owner?.id === self.id,
      },
      (_ctx, event) => {
        attackingSummons.add(event.unit.definitionId);
      }
    );
    for (const event of ["turnStart", "actionStart", "actionEnd"] as const) {
      k.on(event, "ornament", { subject: "any" }, sync);
    }
  },
});
