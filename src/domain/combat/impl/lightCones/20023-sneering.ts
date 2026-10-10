import { defineLightCone } from "../../kit/equipment";

/** Sneering — Elation. */
export default defineLightCone("20023", (k) => {
  const indulgence = k.status({
    id: "sneering-indulgence",
    origin: "lightCone",
    modifiers: [{ stat: "elation", value: k.s(1) }],
  });
  // Aha's extra turns run an Aha Instant too, so they also activate it.
  k.on("ahaInstantStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, indulgence)
  );
  k.on("ahaInstantEnd", "lightCone", { subject: "any" }, (ctx) =>
    ctx.removeStatus(ctx.self, indulgence)
  );
});
