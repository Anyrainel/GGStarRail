import type { BattleApi, BattleEvent } from "../../kit/api";
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
  // An aura of Mask: a memosprite summoned while it lasts joins it, and
  // every copy ends with Mask.
  k.on("statusRemoved", "lightCone", { status: mask }, (ctx) => {
    for (const ally of ctx.allies) {
      if (ally.has(maskTeammates, ctx.self)) {
        ctx.removeStatus(ally, maskTeammates);
      }
    }
  });
  k.on(
    "summoned",
    "lightCone",
    {
      subject: "otherAlly",
      when: (event, self) => event.unit.kind === "memosprite" && self.has(mask),
    },
    (ctx, event) => {
      const turns = ctx.self.remainingTurns(mask);
      if (turns) ctx.applyStatus(event.unit, maskTeammates, { turns });
    }
  );

  // Skill Points recovered beyond the cap count too.
  const RADIANT_FLAME = "earthly-escapade-radiant-flame";
  const recovered = (event: BattleEvent) =>
    Math.max(0, event.delta ?? 0) + (event.overflow ?? 0);
  k.on(
    "skillPointsChanged",
    "lightCone",
    { when: (event) => recovered(event) > 1e-9 },
    (ctx, event) => {
      const stacks = ctx.self.counter(RADIANT_FLAME) + recovered(event);
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
