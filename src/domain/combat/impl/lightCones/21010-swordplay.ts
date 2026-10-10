import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Swordplay — The Hunt. */
export default defineLightCone("21010", (k) => {
  const answers = k.status({
    id: "answers-of-their-own",
    origin: "lightCone",
    maxStacks: k.s(2),
    modifiers: [{ stat: "dmgBoost", value: k.s(1) }],
  });
  // Assumed: one stack per attack on its main target, gained after the
  // attack's hits (the first attack on a new target also grants one). The
  // counter holds the last target's enemy index + 1.
  const LAST_TARGET = "swordplay-last-target";
  k.on("actionEnd", "lightCone", { attack: true }, (ctx, event) => {
    const target = isEnemy(event.target) ? event.target : event.targetsHit?.[0];
    if (!target) return;
    const marker = ctx.enemies.findIndex((enemy) => enemy.id === target.id) + 1;
    if (ctx.self.counter(LAST_TARGET) !== marker) {
      ctx.removeStatus(ctx.self, answers);
      ctx.setCounter(ctx.self, LAST_TARGET, marker);
    }
    ctx.applyStatus(ctx.self, answers, { stacks: ctx.weight });
  });
});
