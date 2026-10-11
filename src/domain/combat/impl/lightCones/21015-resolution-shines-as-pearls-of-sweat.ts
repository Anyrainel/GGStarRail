import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Resolution Shines As Pearls of Sweat — Nihility. */
export default defineLightCone("21015", (k) => {
  const ensnared = k.status({
    id: "ensnared",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "defReduction", value: k.s(2) }],
  });
  // A present Ensnare counts as "already Ensnared" whatever its landing
  // chance, so a failed roll is not retried by later hits.
  k.on(
    "hit",
    "lightCone",
    { when: (event) => isEnemy(event.target) && !event.target.has(ensnared) },
    (ctx, event) => {
      if (!isEnemy(event.target)) return;
      ctx.applyStatus(event.target, ensnared, { baseChance: k.s(1) });
    }
  );
});
