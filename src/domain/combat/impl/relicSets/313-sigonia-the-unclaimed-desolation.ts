import { defineRelicSet } from "../../kit/equipment";

/**
 * Sigonia, the Unclaimed Desolation. CRIT Rate is applied from catalog
 * properties.
 */
export default defineRelicSet("313", {
  twoPiece: (k) => {
    // Kills are not simulated: the stacks are the enemies (defeated by
    // anyone) earlier in the battle, e.g. in previous waves.
    const defeated = k.count(
      "defeated",
      "ornament",
      "enemyDefeated",
      0,
      k.param(2)
    );
    if (defeated > 0) {
      k.stat("ornament", { stat: "critDmg", value: k.param(1) * defeated });
    }
  },
});
