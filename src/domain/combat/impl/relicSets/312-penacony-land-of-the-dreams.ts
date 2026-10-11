import { isCombatTypeId } from "@/domain/stats";
import { defineRelicSet } from "../../kit/equipment";

/**
 * Penacony, Land of the Dreams. Energy Regeneration Rate is applied from
 * catalog properties.
 */
export default defineRelicSet("312", {
  twoPiece: (k) => {
    const combatType = k.wearer.combatType;
    if (!isCombatTypeId(combatType)) {
      throw new Error(`Unknown Combat Type ${combatType}`);
    }
    // The allies' own Combat Type, not the hit's: all their DMG benefits.
    k.teamStat(
      "ornament",
      { stat: "dmgBoost", value: k.param(2) },
      "otherAllies",
      { combatTypes: [combatType] }
    );
  },
});
