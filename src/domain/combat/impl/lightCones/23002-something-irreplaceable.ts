import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Something Irreplaceable — Destruction. ATK is applied from catalog
 * properties.
 */
export default defineLightCone("23002", (k) => {
  // Kills are not simulated: when on, each attack by the wearer is assumed
  // to defeat an enemy.
  const defeats = k.toggle("defeat", "lightCone", "enemyDefeated", false);

  // "Until the end of their next turn": 1 turn (an application during the
  // wearer's own turn skips that turn's countdown).
  const kinship = k.status({
    id: "kinship",
    origin: "lightCone",
    duration: { turns: 1 },
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  const trigger = (ctx: BattleApi, stacks: number) => {
    ctx.applyStatus(ctx.self, kinship, { stacks });
    const maxHp = ctx.self.currentStat("hp");
    if (maxHp <= 0) return;
    const amount =
      k.s(2) *
      ctx.self.currentStat("atk") *
      (1 + ctx.self.currentStat("outgoingHealing"));
    ctx.heal(ctx.self, amount / maxHp);
  };

  // Enemy attacks reach the wearer with its aggro share, so the buff is held
  // with that probability. hitByEnemy precedes the hit's HP loss, so the heal
  // lands before it.
  k.on("hitByEnemy", "lightCone", { limitPerTurn: 1 }, (ctx) =>
    trigger(ctx, ctx.weight)
  );
  if (defeats) {
    k.on("actionEnd", "lightCone", { attack: true, limitPerTurn: 1 }, (ctx) =>
      trigger(ctx, 1)
    );
  }
});
