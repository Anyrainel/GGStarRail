import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Victory In a Blink — Remembrance. CRIT DMG is applied from catalog properties. */
export default defineLightCone("21050", (k) => {
  const finalHit = k.status({
    id: "victory-in-a-blink-dmg",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  // An ability on an ally target: one aimed at an ally (Mem's Support,
  // Demiurge's Ode) or one that does not attack enemies.
  k.on(
    "actionStart",
    "lightCone",
    {
      subject: "memosprite",
      when: (event) =>
        (event.target !== undefined && !isEnemy(event.target)) || !event.attack,
    },
    (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, finalHit);
    }
  );
});
