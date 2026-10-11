import { defineLightCone } from "../../kit/equipment";

/**
 * Post-Op Conversation — Abundance. Energy Regeneration Rate is applied from
 * catalog properties.
 */
export default defineLightCone("21000", (k) => {
  const mutualHealing = k.status({
    id: "mutual-healing",
    origin: "lightCone",
    modifiers: [{ stat: "outgoingHealing", value: k.s(2) }],
  });
  // The bonus covers the Ultimate being used.
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, mutualHealing)
  );
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.removeStatus(ctx.self, mutualHealing)
  );
});
