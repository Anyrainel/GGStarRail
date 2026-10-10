import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Evanescia — Elation, Physical. */
export default defineCharacter("1505", (k) => {
  const PUNCHLINE = "punchline";
  const FOX = "master-fox-energy";
  const AHA_PUNCHLINE = "aha-punchline";
  const ULTIMATES = "ultimates-used";
  /** Energy converted from Certified Banger (it does not convert back). */
  const CONVERTING = "converting-banger";
  // A6: teammates' Aha Instant Certified Banger expiring at their next turn
  // end / the one after (the engine's 2-turn timer), mirrored on the holder.
  const A6_NEXT = "evanescia-a6-next";
  const A6_LATER = "evanescia-a6-later";
  // Talent: "cannot exceed 100 points in a single instance" (no placeholder).
  const BANGER_TO_ENERGY_CAP = 100;
  // E6: "+2% per 100 points ... Up to 1000 points" (no placeholders).
  const E6_STEP = 100;
  const E6_MAX_STACKS = 10;
  const foxThreshold = k.param("04", 3);
  const bangerTurns = 2 + (k.e(6) ? k.rankParam(6, 2) : 0);

  k.stat("talent", {
    stat: "elation",
    scaling: { source: "holder", stat: "critDmg", ratio: k.param("04", 5) },
  });
  if (k.a(1)) k.stat("a2", { stat: "critRate", value: k.traceParam(1, 1) });
  if (k.e(1)) k.stat("e1", { stat: "resPen", value: k.rankParam(1, 1) });
  if (k.e(2)) k.stat("e2", { stat: "critDmg", value: k.rankParam(2, 1) });
  if (k.e(4)) k.stat("e4", { stat: "defIgnore", value: k.rankParam(4, 1) });
  if (k.e(6)) k.stat("e6", { stat: "merrymaking", value: k.rankParam(6, 1) });

  const vulnerability = k.status({
    id: "weigh-all-truths",
    origin: "a4",
    debuff: true,
    duration: { turns: k.traceParam(2, 2) },
    modifiers: [{ stat: "vulnerability", value: k.traceParam(2, 1) }],
  });
  const e6Merrymake = k.status({
    id: "e6-banger-merrymake",
    origin: "e6",
    maxStacks: E6_MAX_STACKS,
    modifiers: [{ stat: "merrymaking", value: k.rankParam(6, 3) }],
  });

  /** Energy toward Master Fox; each gain (per occurrence) counts up to 240. */
  const accumulate = (ctx: BattleApi, gained: number) => {
    ctx.addCounter(ctx.self, FOX, Math.min(gained, foxThreshold));
    while (ctx.self.counter(FOX) >= foxThreshold - 1e-9) {
      ctx.setCounter(ctx.self, FOX, ctx.self.counter(FOX) - foxThreshold);
      ctx.queueAction(ctx.self, "followUp", { weight: 1 / ctx.weight });
    }
  };
  // Every Energy gain, from any source, grants as much Certified Banger
  // (except Energy converted from it) and counts toward Master Fox.
  k.on("energyGained", "talent", {}, (ctx, event) => {
    const gained = event.delta ?? 0;
    if (gained <= 1e-9) return;
    if (ctx.self.counter(CONVERTING) <= 0) {
      ctx.grantCertifiedBanger(ctx.self, gained, bangerTurns);
    }
    accumulate(ctx, gained);
  });
  const energyFromBanger = (ctx: BattleApi, value: number) => {
    ctx.setCounter(ctx.self, CONVERTING, 1);
    ctx.gainEnergy(ctx.self, Math.min(value, BANGER_TO_ENERGY_CAP), {
      fixed: true,
    });
    ctx.setCounter(ctx.self, CONVERTING, 0);
  };
  /** Certified Banger that also grants as much Energy. */
  const gainBanger = (ctx: BattleApi, value: number) => {
    if (value <= 0) return;
    ctx.grantCertifiedBanger(ctx.self, value, bangerTurns);
    energyFromBanger(ctx, value);
  };
  /** A2/A6 conversions, with E2's additional gain. */
  const convert = (ctx: BattleApi, value: number, e2Ratio: number) => {
    gainBanger(ctx, value);
    if (k.e(2)) gainBanger(ctx, value * e2Ratio);
  };

  const bangerHit = (
    ctx: BattleApi,
    hit: Omit<HitDef, "kind" | "punchline">,
    punchline = ctx.self.certifiedBanger()
  ): HitDef[] =>
    ctx.self.certifiedBanger() > 0
      ? [{ ...hit, kind: "elation", punchline }]
      : [];

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: (ctx) => [
      {
        shape: "blast",
        main: k.param("02", 2),
        adjacent: k.param("02", 3),
        toughness: { main: 20, adjacent: 10 },
      },
      ...bangerHit(ctx, {
        shape: "blast",
        main: k.param("04", 7),
        adjacent: k.param("04", 7),
      }),
    ],
    after: (ctx) => ctx.addTeamResource(PUNCHLINE, k.param("02", 4)),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    // Facts: the Ultimate costs 240 of the 480 max Energy.
    energyCost: 240,
    hits: (ctx) => {
      const enemies = ctx.enemies.length;
      const extra = !k.a(1)
        ? 0
        : enemies >= 3
          ? k.traceParam(1, 2)
          : enemies === 2
            ? k.traceParam(1, 3)
            : k.traceParam(1, 4);
      const bounces = k.param("03", 2) + extra;
      // "the amount of Certified Banger taken into account is at least
      // equal to Max Energy".
      const punchline = Math.max(
        ctx.self.certifiedBanger(),
        ctx.self.maxEnergy
      );
      return [
        { shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } },
        {
          shape: "bounce",
          each: k.param("03", 3),
          bounces,
          toughness: { each: 5 },
        },
        ...bangerHit(ctx, { shape: "aoe", each: k.param("04", 6) }, punchline),
        // Read as one Elation hit per bounce instance.
        ...bangerHit(
          ctx,
          { shape: "bounce", each: k.param("04", 8), bounces },
          punchline
        ),
      ];
    },
    after: (ctx) => {
      if (k.e(6)) {
        ctx.addCounter(ctx.self, ULTIMATES, 1);
        const used = Math.round(ctx.self.counter(ULTIMATES));
        if ((used - 1) % k.rankParam(6, 5) === 0) {
          ctx.gainEnergy(ctx.self, k.rankParam(6, 4), { fixed: true });
        }
      }
    },
  });

  // Master Fox: Evanescia's Follow-Up ATK every 240 Energy gained.
  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: k.param("04", 4),
    before: (ctx) => {
      if (!k.a(2)) return;
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, vulnerability);
    },
    hits: (ctx) => [
      { shape: "aoe", each: k.param("04", 1), toughness: { each: 10 } },
      ...bangerHit(ctx, { shape: "aoe", each: k.param("04", 2) }),
    ],
    after: (ctx) => {
      if (k.e(1)) ctx.queueAction(ctx.self, "elationSkill");
    },
  });

  k.ability({
    id: "elationSkill",
    kind: "elationSkill",
    hits: [
      {
        shape: "aoe",
        each: k.param("20", 2),
        kind: "elation",
        toughness: { each: 20 },
      },
    ],
    after: (ctx) => {
      gainBanger(ctx, k.param("20", 1));
      if (k.e(1)) gainBanger(ctx, k.rankParam(1, 2));
    },
  });

  // The Aha Instant grants every participant Certified Banger equal to the
  // Punchline it consumed; the engine reports no gain event, so the value is
  // read when the Instant starts.
  k.on("ahaInstantStart", "talent", { subject: "any" }, (ctx) =>
    ctx.setCounter(ctx.self, AHA_PUNCHLINE, ctx.teamResource(PUNCHLINE))
  );
  k.on("ahaInstantEnd", "talent", { subject: "any" }, (ctx) => {
    const punchline = ctx.self.counter(AHA_PUNCHLINE);
    if (punchline <= 0) return;
    energyFromBanger(ctx, punchline);
    for (const ally of ctx.allies) {
      if (ally === ctx.self || ally.kind !== "character") continue;
      if (ally.pathId !== "Elation") continue;
      // Participant IDs are approximated by team slot, as in the engine.
      if (k.a(1) && ally.slot < ctx.self.slot) {
        convert(ctx, punchline * k.traceParam(1, 5), k.rankParam(2, 2));
      }
      if (k.a(3)) ctx.addCounter(ally, A6_LATER, punchline);
    }
  });

  if (k.a(3)) {
    k.on(
      "turnEnd",
      "a6",
      {
        subject: "otherAlly",
        when: (event) =>
          event.unit.kind === "character" &&
          (event.unit.counter(A6_NEXT) > 0 || event.unit.counter(A6_LATER) > 0),
      },
      (ctx, event) => {
        const ally = event.unit;
        const ending = ally.counter(A6_NEXT);
        ctx.setCounter(ally, A6_NEXT, ally.counter(A6_LATER));
        ctx.setCounter(ally, A6_LATER, 0);
        if (ending > 0) {
          convert(ctx, ending * k.traceParam(3, 1), k.rankParam(2, 3));
        }
      }
    );
  }

  if (k.e(6)) {
    // Certified Banger changes inside other units' turns; Elation DMG only
    // comes from Evanescia's actions, so the stacks sync when one starts.
    k.on("actionStart", "e6", {}, (ctx) => {
      const stacks = Math.min(
        E6_MAX_STACKS,
        Math.floor(ctx.self.certifiedBanger() / E6_STEP + 1e-9)
      );
      if (stacks <= 0) ctx.removeStatus(ctx.self, e6Merrymake);
      else if (ctx.self.has(e6Merrymake)) {
        ctx.setStatusStacks(ctx.self, e6Merrymake, stacks);
      } else ctx.applyStatus(ctx.self, e6Merrymake, { setStacks: stacks });
    });
  }
});
