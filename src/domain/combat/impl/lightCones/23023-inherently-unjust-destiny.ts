import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Inherently Unjust Destiny — Preservation. DEF is applied from catalog
 * properties.
 */
export default defineLightCone("23023", (k) => {
  const allIn = k.status({
    id: "all-in",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  const dmgTaken = k.status({
    id: "all-in-dmg-taken",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(6) },
    modifiers: [{ stat: "vulnerability", value: k.s(5) }],
  });

  // Shields the wearer provides: statuses of the shield family it applies
  // (its summons' Shields, such as Souldragon's, included).
  k.on(
    "statusApplied",
    "lightCone",
    {
      subject: "selfOrMemosprite",
      when: (event) =>
        event.status?.family === "shield" &&
        event.target !== undefined &&
        event.target.kind !== "enemy",
    },
    (ctx) => ctx.applyStatus(ctx.self, allIn)
  );

  // A hit expected less than once on this target (a Counter, a share of a
  // Bounce) scales the base chance.
  k.on("hit", "lightCone", { abilityKinds: ["followUp"] }, (ctx, event) => {
    if (!isEnemy(event.target)) return;
    ctx.applyStatus(event.target, dmgTaken, {
      baseChance: k.s(4) * Math.min(1, ctx.weight),
    });
  });
});
