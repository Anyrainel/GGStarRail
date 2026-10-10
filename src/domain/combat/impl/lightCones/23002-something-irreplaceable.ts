import { defineLightCone } from "../../kit/equipment";

/**
 * Something Irreplaceable — Destruction. ATK is applied from catalog
 * properties.
 */
export default defineLightCone("23002", (k) => {
  // The heal is not modeled. Kills are not simulated: when on, each attack
  // by the wearer is assumed to defeat an enemy.
  const defeats = k.toggle("defeat", "lightCone", "enemyDefeated", false);

  // "Until the end of their next turn": 1 turn (an application during the
  // wearer's own turn skips that turn's countdown).
  const kinship = k.status({
    id: "kinship",
    origin: "lightCone",
    duration: { turns: 1 },
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });

  // Enemy attacks reach the wearer with its aggro share, so the buff is held
  // with that probability.
  k.on("hitByEnemy", "lightCone", { limitPerTurn: 1 }, (ctx) =>
    ctx.applyStatus(ctx.self, kinship, { stacks: ctx.weight })
  );
  if (defeats) {
    k.on("actionEnd", "lightCone", { attack: true, limitPerTurn: 1 }, (ctx) =>
      ctx.applyStatus(ctx.self, kinship)
    );
  }
});
