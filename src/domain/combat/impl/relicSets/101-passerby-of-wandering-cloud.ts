import { defineRelicSet } from "../../kit/equipment";

/**
 * Passerby of Wandering Cloud. Outgoing Healing is applied from catalog
 * properties.
 */
export default defineRelicSet("101", {
  fourPiece: (k) => {
    // "Regenerates 1 Skill Point" is printed without a placeholder.
    k.on("battleStart", "relic4pc", { subject: "any" }, (ctx) =>
      ctx.gainSkillPoints(1)
    );
  },
});
