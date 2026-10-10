import { defineLightCone } from "../../kit/equipment";

/**
 * Thus Burns the Dawn — Destruction. Base SPD is applied from catalog
 * properties.
 */
export default defineLightCone("23044", (k) => {
  k.stat("lightCone", { stat: "defIgnore", value: k.s(2) });

  // Phainon's transformation runs as queued actions without turn starts, so
  // Blazing Sun covers it until his next turn.
  const blazingSun = k.status({
    id: "blazing-sun",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, blazingSun)
  );
  k.on("turnStart", "lightCone", {}, (ctx) =>
    ctx.removeStatus(ctx.self, blazingSun)
  );
});
