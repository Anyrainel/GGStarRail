import { defineLightCone } from "../../kit/equipment";

/** Hey, Over Here — Abundance. Max HP is applied from catalog properties. */
export default defineLightCone("22001", (k) => {
  const notAfraid = k.status({
    id: "im-not-afraid",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "outgoingHealing", value: k.s(2) }],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["skill"] }, (ctx) =>
    ctx.applyStatus(ctx.self, notAfraid)
  );
});
