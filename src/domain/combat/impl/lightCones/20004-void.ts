import { defineLightCone } from "../../kit/equipment";

/** Void — Nihility. */
export default defineLightCone("20004", (k) => {
  const fallen = k.status({
    id: "fallen",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    modifiers: [{ stat: "effectHitRate", value: k.s(1) }],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, fallen)
  );
});
