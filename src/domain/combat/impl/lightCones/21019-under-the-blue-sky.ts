import { defineLightCone } from "../../kit/equipment";

/** Under the Blue Sky — Destruction. ATK is applied from catalog properties. */
export default defineLightCone("21019", (k) => {
  // Kills are not simulated; when on, each attack by the wearer is assumed
  // to defeat an enemy.
  const defeats = k.toggle("defeat", "lightCone", "enemyDefeated", false);
  if (!defeats) return;
  const ryeUnderTheSun = k.status({
    id: "rye-under-the-sun",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critRate", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, ryeUnderTheSun)
  );
});
