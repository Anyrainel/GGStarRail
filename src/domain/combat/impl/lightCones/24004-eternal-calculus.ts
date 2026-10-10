import { defineLightCone } from "../../kit/equipment";

/** Eternal Calculus — Erudition. ATK is applied from catalog properties. */
export default defineLightCone("24004", (k) => {
  const boundlessThought = k.status({
    id: "boundless-thought",
    origin: "lightCone",
    // "Up to 5 times" has no placeholder.
    maxStacks: 5,
    modifiers: [{ stat: "atkPct", value: k.s(2) }],
  });
  const boundlessThoughtSpd = k.status({
    id: "boundless-thought-spd",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    modifiers: [{ stat: "spdPct", value: k.s(4) }],
  });
  // "Lasts until after the next attack": each attack's count replaces it.
  k.on("actionEnd", "lightCone", { attack: true }, (ctx, event) => {
    const enemiesHit = event.targetsHit?.length ?? 0;
    ctx.applyStatus(ctx.self, boundlessThought, { setStacks: enemiesHit });
    if (enemiesHit >= k.s(3)) ctx.applyStatus(ctx.self, boundlessThoughtSpd);
  });
});
