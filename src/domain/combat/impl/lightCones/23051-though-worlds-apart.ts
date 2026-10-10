import { defineLightCone } from "../../kit/equipment";

/** Though Worlds Apart — Preservation. ATK is applied from catalog properties. */
export default defineLightCone("23051", (k) => {
  const redoubt = k.status({
    id: "redoubt",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const redoubtSummoner = k.status({
    id: "redoubt-summoner",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  // The heal is not modeled. Summons are checked when Redoubt is granted;
  // kits only see memosprites (engine-gap).
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    for (const ally of ctx.allies) {
      ctx.applyStatus(ally, redoubt);
      if (ctx.allies.some((unit) => unit.owner?.id === ally.id)) {
        ctx.applyStatus(ally, redoubtSummoner);
      } else {
        ctx.removeStatus(ally, redoubtSummoner);
      }
    }
  });
});
