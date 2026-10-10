import { defineLightCone } from "../../kit/equipment";

/** Geniuses' Repose — Erudition. ATK is applied from catalog properties. */
export default defineLightCone("21020", (k) => {
  // Kills are not simulated; when on, each attack by the wearer is assumed
  // to defeat an enemy.
  const defeats = k.toggle("defeat", "lightCone", "enemyDefeated", false);
  if (!defeats) return;
  const eachNowHasARole = k.status({
    id: "each-now-has-a-role",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, eachNowHasARole)
  );
});
