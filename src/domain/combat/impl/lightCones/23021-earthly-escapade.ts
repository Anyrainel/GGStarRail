import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Earthly Escapade — Harmony. CRIT DMG is applied from catalog properties. */
export default defineLightCone("23021", (k) => {
  const mask = k.status({
    id: "earthly-escapade-mask",
    origin: "lightCone",
    duration: { turns: k.s(6) },
  });
  // Counts down on the wearer's turns, so it ends together with Mask.
  const maskTeammates = k.status({
    id: "earthly-escapade-mask-teammates",
    origin: "lightCone",
    duration: { turns: k.s(6), clock: "applier" },
    modifiers: [
      { stat: "critRate", value: k.s(5) },
      { stat: "critDmg", value: k.s(2) },
    ],
  });
  const gainMask = (ctx: BattleApi, turns: number) => {
    ctx.applyStatus(ctx.self, mask, { turns });
    for (const ally of ctx.allies) {
      if (ally !== ctx.self) ctx.applyStatus(ally, maskTeammates, { turns });
    }
  };
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    gainMask(ctx, k.s(6))
  );

  // Skill Points lost to the cap are not reported by the engine (tracked).
  const RADIANT_FLAME = "earthly-escapade-radiant-flame";
  k.on(
    "skillPointsChanged",
    "lightCone",
    { when: (event) => (event.delta ?? 0) > 0 },
    (ctx, event) => {
      const stacks = ctx.self.counter(RADIANT_FLAME) + (event.delta ?? 0);
      const threshold = k.s(4);
      if (stacks + 1e-9 < threshold) {
        ctx.setCounter(ctx.self, RADIANT_FLAME, stacks);
        return;
      }
      // Stacks are gained one Skill Point at a time: the ones left after
      // the last removal carry over.
      ctx.setCounter(
        ctx.self,
        RADIANT_FLAME,
        stacks - threshold * Math.floor(stacks / threshold + 1e-9)
      );
      gainMask(ctx, k.s(3));
    }
  );
});
