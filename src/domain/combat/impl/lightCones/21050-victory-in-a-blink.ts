import { defineLightCone } from "../../kit/equipment";

/** Victory In a Blink — Remembrance. CRIT DMG is applied from catalog properties. */
export default defineLightCone("21050", (k) => {
  // Applied once to the ally targets present: a memosprite summoned during
  // the 3 turns does not get it.
  const finalHit = k.status({
    id: "victory-in-a-blink-dmg",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  // "On an ally target" (对我方目标): one ally, all allies, or itself.
  k.on(
    "actionStart",
    "lightCone",
    {
      subject: "memosprite",
      when: (event) =>
        event.abilityTarget === "ally" ||
        event.abilityTarget === "allies" ||
        event.abilityTarget === "self",
    },
    (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, finalHit);
    }
  );
});
