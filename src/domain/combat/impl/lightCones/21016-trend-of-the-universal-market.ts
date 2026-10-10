import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Trend of the Universal Market — Preservation. DEF is applied from catalog
 * properties.
 */
export default defineLightCone("21016", (k) => {
  // Burn deals Fire DoT whatever the wearer's Combat Type.
  const burn = k.status({
    id: "burn",
    origin: "lightCone",
    debuff: true,
    family: "burn",
    duration: { turns: k.s(4) },
    dot: {
      hit: {
        shape: "single",
        main: k.s(3),
        stat: "def",
        kind: "dot",
        combatType: "Fire",
      },
    },
  });
  // The attacking enemy hits the wearer with its aggro share, which scales
  // the base chance. Repeated attacks keep the highest chance, not the
  // accumulated one.
  k.on("hitByEnemy", "lightCone", {}, (ctx, event) => {
    if (!isEnemy(event.target)) return;
    ctx.applyStatus(event.target, burn, { baseChance: k.s(2) * ctx.weight });
  });
});
