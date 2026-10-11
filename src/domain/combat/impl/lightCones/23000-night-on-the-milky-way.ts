import { defineLightCone } from "../../kit/equipment";

/** Night on the Milky Way — Erudition. */
export default defineLightCone("23000", (k) => {
  const meteorSwarm = k.status({
    id: "meteor-swarm",
    origin: "lightCone",
    // "Up to 5 stacks" has no placeholder.
    maxStacks: 5,
    modifiers: [{ stat: "atkPct", value: k.s(2) }],
  });
  // Enemies are never removed in the simulation: the count is set once.
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, meteorSwarm, { setStacks: ctx.enemies.length })
  );

  const weaknessBroken = k.status({
    id: "night-on-the-milky-way-break",
    origin: "lightCone",
    duration: { turns: 1 },
    modifiers: [{ stat: "dmgBoost", value: k.s(1) }],
  });
  // Any enemy's Weakness Break, by any ally.
  k.on("weaknessBreak", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, weaknessBroken)
  );
});
