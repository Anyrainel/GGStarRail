import { defineLightCone } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

/**
 * Solitary Healing — Nihility. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("24003", (k) => {
  const chaosElixir = k.status({
    id: "chaos-elixir",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "dmgBoost", value: k.s(2), filter: { tags: ["dot"] } }],
  });
  // Before the Ultimate's own DoT DMG (detonations) resolves.
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.applyStatus(ctx.self, chaosElixir)
  );

  // Kills are not simulated; when on, an enemy carrying the wearer's DoT is
  // assumed to fall once per wearer's turn.
  if (k.toggle("dot-target-defeated", "lightCone", "enemyDefeated", false)) {
    // Weakness Break DoTs count; Frozen and Entanglement are not DoTs.
    const ownDots = new Set<StatusDef>();
    k.on(
      "statusApplied",
      "lightCone",
      {
        when: (event) =>
          event.status?.dot !== undefined &&
          event.status.family !== "frozen" &&
          event.status.family !== "entanglement",
      },
      (_ctx, event) => {
        if (event.status) ownDots.add(event.status);
      }
    );
    k.on("turnEnd", "lightCone", {}, (ctx) => {
      const afflicted = ctx.enemies.some((enemy) =>
        [...ownDots].some((dot) => enemy.has(dot, ctx.self))
      );
      if (afflicted) ctx.gainEnergy(ctx.self, k.s(4));
    });
  }
});
