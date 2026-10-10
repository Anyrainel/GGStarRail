import { defineLightCone } from "../../kit/equipment";

/** Darting Arrow — The Hunt. */
export default defineLightCone("20007", (k) => {
  // Kills are not simulated; when on, each attack by the wearer is assumed
  // to defeat an enemy.
  const defeats = k.toggle("defeat", "lightCone", "enemyDefeated", false);
  if (!defeats) return;
  const warCry = k.status({
    id: "war-cry",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    modifiers: [{ stat: "atkPct", value: k.s(1) }],
  });
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, warCry)
  );
});
