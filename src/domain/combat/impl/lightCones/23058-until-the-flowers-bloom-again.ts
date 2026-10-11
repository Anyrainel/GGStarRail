import { defineLightCone } from "../../kit/equipment";

/**
 * Until the Flowers Bloom Again — Elation. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23058", (k) => {
  // Max Energy is fixed per Character, so the bonus is a constant. "For
  // every 10 points" has no placeholder.
  const excess = Math.min(Math.max(0, k.wearer.maxEnergy - k.s(5)), k.s(7));
  k.stat("lightCone", {
    stat: "energyRegen",
    value: k.s(4) + Math.floor(excess / 10 + 1e-9) * k.s(6),
  });

  const daydream = k.status({
    id: "until-the-flowers-bloom-again-daydream",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "vulnerability", value: k.s(2) }],
  });
  k.on(
    "actionStart",
    "lightCone",
    { abilityKinds: ["elationSkill"] },
    (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, daydream);
    }
  );
});
