import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Long Road Leads Home — Nihility. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("23035", (k) => {
  const charring = k.status({
    id: "charring",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(4) },
    maxStacks: k.s(5),
    modifiers: [
      { stat: "vulnerability", value: k.s(3), filter: { tags: ["break"] } },
    ],
  });
  // Any enemy's Weakness Break, whoever breaks it.
  k.on("weaknessBreak", "lightCone", { subject: "any" }, (ctx, event) => {
    if (isEnemy(event.target)) {
      ctx.applyStatus(event.target, charring, { baseChance: k.s(2) });
    }
  });
});
