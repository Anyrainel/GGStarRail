import { defineLightCone } from "../../kit/equipment";

/** Dream's Montage — Abundance. SPD is applied from catalog properties. */
export default defineLightCone("21048", (k) => {
  k.on(
    "actionEnd",
    "lightCone",
    {
      attack: true,
      limitPerTurn: k.s(3),
      when: (event) => event.targetsHit?.some((enemy) => enemy.broken) ?? false,
    },
    (ctx) => ctx.gainEnergy(ctx.self, k.s(2))
  );
});
