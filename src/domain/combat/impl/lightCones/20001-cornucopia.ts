import { defineLightCone } from "../../kit/equipment";

/** Cornucopia — Abundance. */
export default defineLightCone("20001", (k) => {
  const prosperity = k.status({
    id: "prosperity",
    origin: "lightCone",
    modifiers: [{ stat: "outgoingHealing", value: k.s(1) }],
  });
  // The bonus covers the Skill or Ultimate being used.
  const kinds = ["skill", "ultimate"] as const;
  k.on("actionStart", "lightCone", { abilityKinds: kinds }, (ctx) =>
    ctx.applyStatus(ctx.self, prosperity)
  );
  k.on("actionEnd", "lightCone", { abilityKinds: kinds }, (ctx) =>
    ctx.removeStatus(ctx.self, prosperity)
  );
});
