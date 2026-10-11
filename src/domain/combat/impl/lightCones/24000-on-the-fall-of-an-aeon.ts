import { defineLightCone } from "../../kit/equipment";

/** On the Fall of an Aeon — Destruction. */
export default defineLightCone("24000", (k) => {
  const mothToFlames = k.status({
    id: "moth-to-flames",
    origin: "lightCone",
    maxStacks: k.s(2),
    modifiers: [{ stat: "atkPct", value: k.s(1) }],
  });
  k.on("actionStart", "lightCone", { attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, mothToFlames)
  );

  const weaknessBroken = k.status({
    id: "moth-to-flames-break",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  k.on("weaknessBreak", "lightCone", {}, (ctx) =>
    ctx.applyStatus(ctx.self, weaknessBroken)
  );
});
