import { defineLightCone } from "../../kit/equipment";

/**
 * She Already Shut Her Eyes — Preservation. Max HP and Energy Regeneration
 * Rate are applied from catalog properties; the wave-start heal is not
 * modeled.
 */
export default defineLightCone("23011", (k) => {
  const visioscape = k.status({
    id: "visioscape",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  // HP is not simulated: enemy hits reduce the wearer's HP with its aggro
  // share, held as expected stacks. When on (default for Fu Xuan, whose
  // Matrix of Prescience moves part of every ally's DMG taken to her), hits
  // on any ally reduce it.
  const sharedDmg = k.toggle(
    "ally-dmg-shared",
    "lightCone",
    "active",
    k.wearer.characterId === "1208"
  );
  k.on(
    "hitByEnemy",
    "lightCone",
    { subject: sharedDmg ? "ally" : "self" },
    (ctx) => {
      for (const ally of ctx.allies) {
        ctx.applyStatus(ally, visioscape, { stacks: ctx.weight });
      }
    }
  );
});
