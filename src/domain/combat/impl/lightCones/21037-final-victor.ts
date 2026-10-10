import { defineLightCone } from "../../kit/equipment";

/** Final Victor — The Hunt. ATK is applied from catalog properties. */
export default defineLightCone("21037", (k) => {
  const goodFortune = k.status({
    id: "good-fortune",
    origin: "lightCone",
    maxStacks: k.s(3),
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  // CRIT is evaluated in expectation: each hit on an enemy grants its CRIT
  // chance (panel CRIT Rate) in stacks, from the next hit on.
  k.on("hit", "lightCone", {}, (ctx) => {
    const chance = Math.min(1, Math.max(0, ctx.self.panelStat("critRate")));
    if (chance > 0) {
      ctx.applyStatus(ctx.self, goodFortune, { stacks: chance * ctx.weight });
    }
  });
  k.on("turnEnd", "lightCone", {}, (ctx) =>
    ctx.removeStatus(ctx.self, goodFortune)
  );
});
