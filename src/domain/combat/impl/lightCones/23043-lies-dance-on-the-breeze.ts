import { defineLightCone } from "../../kit/equipment";

/**
 * Lies Dance on the Breeze — Nihility. SPD is applied from catalog
 * properties.
 */
export default defineLightCone("23043", (k) => {
  // "Only the most recently inflicted instance takes effect": instances from
  // several wearers do not add up.
  const bamboozle = k.status({
    id: "bamboozle",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "defReduction", value: k.s(3) }],
  });
  const theft = k.status({
    id: "theft",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "defReduction", value: k.s(6) }],
  });

  k.on("actionEnd", "lightCone", { attack: true }, (ctx) => {
    const fast = ctx.self.speed >= k.s(7) - 1e-9;
    for (const enemy of ctx.enemies) {
      ctx.applyStatus(enemy, bamboozle, { baseChance: k.s(2) });
      if (fast) ctx.applyStatus(enemy, theft, { baseChance: k.s(5) });
    }
  });
});
