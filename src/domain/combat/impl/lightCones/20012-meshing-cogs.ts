import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Meshing Cogs — Harmony. */
export default defineLightCone("20012", (k) => {
  // Attacking and getting hit share one trigger per turn: the expected
  // firings of the current turn are kept in a counter reset at every turn.
  const used = "meshing-cogs-used";
  k.on("turnStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.setCounter(ctx.self, used, 0)
  );
  const available = (self: { counter(name: string): number }) =>
    self.counter(used) < 1 - 1e-9;
  const regenerate = (ctx: BattleApi) => {
    // Both calls scale with the trigger's weight: only what is left fits.
    const share = Math.min(1, (1 - ctx.self.counter(used)) / ctx.weight);
    ctx.addCounter(ctx.self, used, share);
    ctx.gainEnergy(ctx.self, k.s(1) * share);
  };
  k.on(
    "actionEnd",
    "lightCone",
    { attack: true, when: (_, self) => available(self) },
    regenerate
  );
  k.on(
    "hitByEnemy",
    "lightCone",
    { when: (_, self) => available(self) },
    regenerate
  );
});
