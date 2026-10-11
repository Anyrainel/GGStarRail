import { defineLightCone } from "../../kit/equipment";

/** A Star That Lights the Night — Erudition. #1 is not referenced by the text. */
export default defineLightCone("23060", (k) => {
  k.stat("lightCone", { stat: "defIgnore", value: k.s(7) });

  // "Lasting for 2 turns" has no placeholder.
  const sail = k.status({
    id: "sail",
    origin: "lightCone",
    duration: { turns: 2 },
    maxStacks: k.s(3),
    modifiers: [
      { stat: "dmgBoost", value: k.s(4), filter: { tags: ["assist"] } },
    ],
  });
  // The Ultimate bonus, per stack of "Sail" once it reaches the threshold.
  // Applied together with "Sail" and with the same duration, so both expire
  // at once.
  const sailUltimate = k.status({
    id: "sail-ultimate",
    origin: "lightCone",
    duration: { turns: 2 },
    maxStacks: k.s(3),
    modifiers: [
      { stat: "dmgBoost", value: k.s(6), filter: { tags: ["ultimate"] } },
    ],
  });
  k.on("actionStart", "lightCone", { tags: ["assist"] }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.s(2));
    ctx.applyStatus(ctx.self, sail);
    const stacks = ctx.self.stacks(sail);
    if (stacks + 1e-9 >= k.s(5)) {
      ctx.applyStatus(ctx.self, sailUltimate, { setStacks: stacks });
    }
  });
});
