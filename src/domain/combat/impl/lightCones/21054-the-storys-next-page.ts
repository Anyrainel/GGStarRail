import { defineLightCone } from "../../kit/equipment";

/** The Story's Next Page — Remembrance. Max HP is applied from catalog properties. */
export default defineLightCone("21054", (k) => {
  // Healing is not simulated (U12). Hyacine's healing tally reads her
  // steady panel, so this buff does not reach Rainclouds (tracker
  // the-storys-next-page-healing-tally).
  const writtenDown = k.status({
    id: "the-storys-next-page-healing",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "outgoingHealing", value: k.s(2) }],
  });
  k.on(
    "actionEnd",
    "lightCone",
    { subject: "memosprite", attack: true },
    (ctx, event) => {
      ctx.applyStatus(ctx.self, writtenDown);
      ctx.applyStatus(event.unit, writtenDown);
    }
  );
});
