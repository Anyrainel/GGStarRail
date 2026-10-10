import { defineLightCone } from "../../kit/equipment";

/** Flames Afar — Destruction. */
export default defineLightCone("21038", (k) => {
  // HP is not simulated. When on, the wearer is assumed to lose or consume
  // more than #1 of its Max HP at once at the start of each of its actions
  // while the effect is off cooldown (HP costs precede the DMG). The heal is
  // not modeled.
  const hpLoss = k.toggle("hp-loss", "lightCone", "active", true);
  if (!hpLoss) return;
  const deflagration = k.status({
    id: "deflagration",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const cooldown = k.status({
    id: "deflagration-cooldown",
    origin: "lightCone",
    duration: { turns: k.s(5) },
  });
  k.on(
    "actionStart",
    "lightCone",
    { when: (_, self) => !self.has(cooldown) },
    (ctx) => {
      ctx.applyStatus(ctx.self, deflagration);
      ctx.applyStatus(ctx.self, cooldown);
    }
  );
});
