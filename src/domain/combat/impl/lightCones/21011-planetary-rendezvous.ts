import { isCombatTypeId } from "@/domain/stats";
import { defineLightCone } from "../../kit/equipment";

/** Planetary Rendezvous — Harmony. */
export default defineLightCone("21011", (k) => {
  const combatType = k.wearer.combatType;
  if (!isCombatTypeId(combatType)) {
    throw new Error(`Unknown Combat Type ${combatType}`);
  }
  // "Deals the same DMG Type as the wearer": the hit's Combat Type.
  k.teamStat("lightCone", {
    stat: "dmgBoost",
    value: k.s(1),
    filter: { combatTypes: [combatType] },
  });
});
