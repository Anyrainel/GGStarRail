import type { UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Past and Future — Harmony. */
export default defineLightCone("21025", (k) => {
  // Copies from several wearers do not stack, like equipment team auras.
  const kites = k.status({
    id: "kites-from-the-past",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    modifiers: [{ stat: "dmgBoost", value: k.s(1) }],
    unique: true,
  });
  // The next ally is read from the Action Order after the Skill resolves,
  // so an ally the Skill advanced (Bronya) receives it.
  k.on("actionEnd", "lightCone", { abilityKinds: ["skill"] }, (ctx) => {
    let next: UnitView | null = null;
    for (const ally of ctx.allies) {
      if (ally === ctx.self || !ally.inActionOrder) continue;
      if (
        !next ||
        ally.actionGauge / ally.speed < next.actionGauge / next.speed - 1e-9
      ) {
        next = ally;
      }
    }
    if (next) ctx.applyStatus(next, kites);
  });
});
