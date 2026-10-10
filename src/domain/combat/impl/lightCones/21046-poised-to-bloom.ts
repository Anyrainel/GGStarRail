import { defineLightCone } from "../../kit/equipment";

/** Poised to Bloom — Harmony. ATK is applied from catalog properties. */
export default defineLightCone("21046", (k) => {
  const bloom = k.status({
    id: "poised-to-bloom-crit-dmg",
    origin: "lightCone",
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
    unique: true,
  });
  // "These characters": memosprites are excluded.
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    const characters = ctx.allies.filter((ally) => ally.kind === "character");
    for (const ally of characters) {
      const samePath = characters.filter(
        (other) => other.pathId === ally.pathId
      );
      if (samePath.length >= 2) ctx.applyStatus(ally, bloom);
    }
  });
});
