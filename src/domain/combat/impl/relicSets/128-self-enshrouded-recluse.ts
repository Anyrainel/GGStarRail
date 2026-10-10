import { defineRelicSet } from "../../kit/equipment";

/** Self-Enshrouded Recluse. Shield Effect is not modelled. */
export default defineRelicSet("128", {
  fourPiece: (k) => {
    // Shields are not simulated: whether allies hold the wearer's Shield is
    // an option, held for the whole battle by default (see tracker).
    if (!k.toggle("shielded", "relic4pc", "active", true)) return;
    k.teamStat("relic4pc", { stat: "critDmg", value: k.param(2) });
  },
});
