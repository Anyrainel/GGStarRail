import { defineLightCone } from "../../kit/equipment";

/**
 * Yet Hope Is Priceless — Erudition. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23028", (k) => {
  // "For every 20% CRIT DMG that exceeds 120%", up to 4 stacks.
  k.stat("lightCone", {
    stat: "dmgBoost",
    filter: { tags: ["followUp"] },
    scaling: {
      source: "holder",
      stat: "critDmg",
      threshold: k.s(2),
      step: k.s(3),
      ratio: k.s(4),
      cap: k.s(4) * k.s(5),
    },
  });

  const defIgnore = k.status({
    id: "yet-hope-is-priceless-def-ignore",
    origin: "lightCone",
    duration: { turns: k.s(7) },
    modifiers: [
      {
        stat: "defIgnore",
        value: k.s(6),
        filter: { tags: ["ultimate", "followUp"] },
      },
    ],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, defIgnore)
  );
  k.on("actionEnd", "lightCone", { abilityKinds: ["basic"] }, (ctx) =>
    ctx.applyStatus(ctx.self, defIgnore)
  );
});
