import { defineLightCone } from "../../kit/equipment";

/**
 * Cruising in the Stellar Sea — The Hunt. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("24001", (k) => {
  // Enemy HP is not simulated: one assumption for every target.
  const lowHp = k.toggle(
    "enemy-hp-below",
    "lightCone",
    "enemyHpBelow",
    true,
    k.s(2)
  );
  if (lowHp) k.stat("lightCone", { stat: "critRate", value: k.s(3) });

  // Kills are not simulated; when on, each attack by the wearer is assumed
  // to defeat an enemy.
  const defeats = k.toggle("defeat", "lightCone", "enemyDefeated", false);
  if (!defeats) return;
  const chase = k.status({
    id: "chase",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    modifiers: [{ stat: "atkPct", value: k.s(4) }],
  });
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, chase)
  );
});
