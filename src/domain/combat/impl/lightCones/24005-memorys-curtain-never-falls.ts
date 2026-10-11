import { defineLightCone } from "../../kit/equipment";

/** Memory's Curtain Never Falls — Remembrance. SPD is applied from catalog properties. */
export default defineLightCone("24005", (k) => {
  const reception = k.status({
    id: "memorys-curtain-never-falls-dmg",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["skill"] }, (ctx) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, reception);
  });
});
