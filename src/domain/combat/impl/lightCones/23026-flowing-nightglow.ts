import { defineLightCone } from "../../kit/equipment";

/** Flowing Nightglow — Harmony. */
export default defineLightCone("23026", (k) => {
  const cantillation = k.status({
    id: "flowing-nightglow-cantillation",
    origin: "lightCone",
    maxStacks: k.s(2),
    modifiers: [{ stat: "energyRegen", value: k.s(1) }],
  });
  k.on("actionEnd", "lightCone", { subject: "ally", attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, cantillation, { stacks: ctx.weight })
  );

  const cadenza = k.status({
    id: "flowing-nightglow-cadenza",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    modifiers: [{ stat: "atkPct", value: k.s(4) }],
  });
  // The allies' part belongs to Cadenza: it counts down on the wearer's
  // turns so both end together.
  const cadenzaAllies = k.status({
    id: "flowing-nightglow-cadenza-allies",
    origin: "lightCone",
    duration: { turns: k.s(5), clock: "applier" },
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    ctx.removeStatus(ctx.self, cantillation);
    ctx.applyStatus(ctx.self, cadenza);
    for (const ally of ctx.allies) ctx.applyStatus(ally, cadenzaAllies);
  });
});
