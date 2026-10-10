import { defineRelicSet } from "../../kit/equipment";

/** Warrior Goddess of Sun and Thunder. SPD is applied from catalog properties. */
export default defineRelicSet("125", {
  fourPiece: (k) => {
    // Healing is not simulated: a healer refreshes the 2-turn "Gentle Rain"
    // on almost every action, so it is an option held for the whole battle
    // (see tracker). Identical team auras from two wearers do not stack.
    if (!k.toggle("gentle-rain", "relic4pc", "active", true)) return;
    k.stat("relic4pc", { stat: "spdPct", value: k.param(1) });
    k.teamStat("relic4pc", { stat: "critDmg", value: k.param(2) });
  },
});
