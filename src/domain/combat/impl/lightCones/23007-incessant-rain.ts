import { defineLightCone } from "../../kit/equipment";

/**
 * Incessant Rain — Nihility. Effect Hit Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23007", (k) => {
  k.stat("lightCone", {
    stat: "critRate",
    value: k.s(5),
    filter: { minTargetDebuffs: k.s(4) },
  });

  // Stacks hold the chance that a target carries Aether Code. "For 1 turn"
  // is printed without a placeholder.
  const aetherCode = k.status({
    id: "aether-code",
    origin: "lightCone",
    debuff: true,
    duration: { turns: 1 },
    maxStacks: 1,
    modifiers: [{ stat: "vulnerability", value: k.s(3) }],
  });
  // One random hit target without Aether Code receives it: each target's
  // share is its chance of lacking it over the expected number lacking it.
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["basic", "skill", "ultimate"], attack: true },
    (ctx, event) => {
      const targets = event.targetsHit ?? [];
      const missing = targets.map((target) =>
        Math.max(0, 1 - target.stacks(aetherCode, ctx.self))
      );
      const total = missing.reduce((sum, value) => sum + value, 0);
      if (total <= 1e-9) return;
      targets.forEach((target, index) => {
        const share = ((missing[index] ?? 0) / Math.max(1, total)) * ctx.weight;
        if (share <= 1e-9) return;
        ctx.applyStatus(target, aetherCode, {
          stacks: share,
          baseChance: k.s(2),
        });
      });
    }
  );
});
