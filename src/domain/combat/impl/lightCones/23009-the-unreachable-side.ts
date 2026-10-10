import { defineLightCone } from "../../kit/equipment";

/**
 * The Unreachable Side — Destruction. CRIT Rate and Max HP are applied from
 * catalog properties.
 */
export default defineLightCone("23009", (k) => {
  const unfulfilled = k.status({
    id: "unfulfilled-yearning",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });

  // Enemy attacks reach the wearer with its aggro share.
  k.on("hitByEnemy", "lightCone", {}, (ctx) =>
    ctx.applyStatus(ctx.self, unfulfilled, { stacks: ctx.weight })
  );
  // HP the wearer consumes itself (Character kits consume it before the
  // hits of the attack that pays it).
  k.on(
    "hpChanged",
    "lightCone",
    {
      when: (event, self) =>
        event.hpCause === "consume" &&
        event.source === self &&
        (event.delta ?? 0) < 0,
    },
    (ctx) => ctx.applyStatus(ctx.self, unfulfilled, { stacks: ctx.weight })
  );
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.removeStatus(ctx.self, unfulfilled)
  );
});
