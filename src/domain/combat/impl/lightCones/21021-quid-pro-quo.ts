import { defineLightCone } from "../../kit/equipment";

/** Quid Pro Quo — Abundance. */
export default defineLightCone("21021", (k) => {
  k.on("turnStart", "lightCone", {}, (ctx) => {
    const candidates = ctx.allies.filter(
      (ally) =>
        ally.kind === "character" &&
        ally !== ctx.self &&
        ally.maxEnergy > 0 &&
        ally.energy < ally.maxEnergy * k.s(1) - 1e-9
    );
    // One random candidate: each receives its expected share.
    for (const ally of candidates) {
      ctx.gainEnergy(ally, k.s(2) / candidates.length);
    }
  });
});
