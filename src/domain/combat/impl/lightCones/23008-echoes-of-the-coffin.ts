import { defineLightCone } from "../../kit/equipment";

/** Echoes of the Coffin — Abundance. ATK is applied from catalog properties. */
export default defineLightCone("23008", (k) => {
  k.on("actionEnd", "lightCone", { attack: true }, (ctx, event) => {
    const enemies = Math.min(event.targetsHit?.length ?? 0, k.s(4));
    if (enemies > 0) ctx.gainEnergy(ctx.self, k.s(3) * enemies);
  });

  const thorns = k.status({
    id: "thorns",
    origin: "lightCone",
    duration: { turns: 1 },
    modifiers: [{ stat: "spdFlat", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, thorns);
  });
});
