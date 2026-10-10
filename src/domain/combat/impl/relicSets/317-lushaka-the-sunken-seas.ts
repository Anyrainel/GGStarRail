import { defineRelicSet } from "../../kit/equipment";

/**
 * Lushaka, the Sunken Seas. Energy Regeneration Rate is applied from catalog
 * properties.
 */
export default defineRelicSet("317", {
  twoPiece: (k) => {
    // Like identical equipment auras, copies from several wearers keep one.
    const firstAtk = k.status({
      id: "lushaka-first-character-atk",
      origin: "ornament",
      unique: true,
      modifiers: [{ stat: "atkPct", value: k.param(2) }],
    });
    k.on("battleStart", "ornament", { subject: "any" }, (ctx) => {
      if (ctx.self.slot === 0) return;
      const first = ctx.allies.find(
        (ally) => ally.kind === "character" && ally.slot === 0
      );
      if (first) ctx.applyStatus(first, firstAtk);
    });
  },
});
