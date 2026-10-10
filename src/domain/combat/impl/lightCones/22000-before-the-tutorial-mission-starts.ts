import { defineLightCone } from "../../kit/equipment";

/**
 * Before the Tutorial Mission Starts — Nihility. Effect Hit Rate is applied
 * from catalog properties.
 */
export default defineLightCone("22000", (k) => {
  // Once per attack that hit at least one DEF-reduced enemy, including a DEF
  // reduction the attack itself applied (ZH: after attacking, 攻击…后). A
  // base-chance DEF reduction counts as landed (engine-debuff-landing-chance).
  k.on(
    "actionEnd",
    "lightCone",
    {
      attack: true,
      when: (event) =>
        (event.targetsHit ?? []).some((enemy) => enemy.hasFamily("defReduced")),
    },
    (ctx) => {
      ctx.gainEnergy(ctx.self, k.s(2));
    }
  );
});
