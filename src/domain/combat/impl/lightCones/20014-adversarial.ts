import { defineLightCone } from "../../kit/equipment";

/** Adversarial — The Hunt. */
export default defineLightCone("20014", (k) => {
  // Kills are not simulated; when on, each attack by the wearer is assumed
  // to defeat an enemy.
  const defeats = k.toggle("defeat", "lightCone", "enemyDefeated", false);
  if (!defeats) return;
  const alliance = k.status({
    id: "alliance",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    modifiers: [{ stat: "spdPct", value: k.s(1) }],
  });
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, alliance)
  );
});
