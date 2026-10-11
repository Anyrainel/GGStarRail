import { defineLightCone } from "../../kit/equipment";

/** Flames Afar — Destruction. */
export default defineLightCone("21038", (k) => {
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
  // Only HP consumption is listened to: an enemy attack removes 10% of Max
  // HP split by aggro, so "HP lost during one attack" never exceeds #1.
  k.on(
    "hpChanged",
    "lightCone",
    {
      when: (event, self) =>
        event.hpCause === "consume" &&
        -(event.delta ?? 0) > k.s(1) + 1e-9 &&
        !self.has(cooldown),
    },
    (ctx) => {
      const boost = 1 + ctx.self.currentStat("outgoingHealing");
      ctx.heal(ctx.self, k.s(3) * boost);
      ctx.applyStatus(ctx.self, deflagration, { stacks: ctx.weight });
      ctx.applyStatus(ctx.self, cooldown);
    }
  );
});
