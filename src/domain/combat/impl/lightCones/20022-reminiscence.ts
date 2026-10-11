import { defineLightCone } from "../../kit/equipment";

/** Reminiscence — Remembrance. */
export default defineLightCone("20022", (k) => {
  const commemoration = k.status({
    id: "reminiscence-commemoration",
    origin: "lightCone",
    maxStacks: k.s(2),
    modifiers: [{ stat: "dmgBoost", value: k.s(1) }],
  });
  k.on("turnStart", "lightCone", { subject: "memosprite" }, (ctx, event) => {
    ctx.applyStatus(ctx.self, commemoration);
    ctx.applyStatus(event.unit, commemoration);
  });
  k.on("departed", "lightCone", { subject: "memosprite" }, (ctx, event) => {
    ctx.removeStatus(ctx.self, commemoration);
    ctx.removeStatus(event.unit, commemoration);
  });
});
