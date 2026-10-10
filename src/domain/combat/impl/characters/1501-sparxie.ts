import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { EffectOrigin, HitDef, StatusDef } from "../../kit/model";

const THRILL = "thrill";
const FARMS = "engagement-farming";

/** `x` as integer outcomes with probabilities (fractional expected values). */
function outcomes(x: number): [number, number][] {
  const rounded = Math.round(x);
  if (Math.abs(x - rounded) < 1e-6) return [[rounded, 1]];
  const low = Math.floor(x);
  return [
    [low, 1 - (x - low)],
    [low + 1, x - low],
  ];
}

/**
 * Engagement Farming after the Skill's own trigger. Sparxie keeps farming
 * while she can pay (Thrill first, then Skill Points), up to the cap. Each
 * trigger refunds `refund` SP half the time ("Straight Fire"), so how long
 * she keeps going is a random walk on SP; this returns, per further trigger,
 * the probability that it happens paid with Thrill and paid with SP.
 */
function farmingOdds(
  skillPoints: number,
  thrill: number,
  maxSkillPoints: number,
  remaining: number,
  refund: number
): { thrill: number; sp: number }[] {
  const odds = Array.from({ length: remaining }, () => ({ thrill: 0, sp: 0 }));
  const max = Math.round(maxSkillPoints);
  const gift = (dist: number[]) => {
    const next = new Array<number>(max + 1).fill(0);
    dist.forEach((mass, sp) => {
      next[sp] = (next[sp] ?? 0) + mass / 2;
      const refunded = Math.min(max, sp + refund);
      next[refunded] = (next[refunded] ?? 0) + mass / 2;
    });
    return next;
  };
  for (const [sp, spChance] of outcomes(Math.min(skillPoints, max))) {
    for (const [owned, thrillChance] of outcomes(thrill)) {
      const weight = spChance * thrillChance;
      const start = new Array<number>(max + 1).fill(0);
      start[Math.max(0, sp)] = 1;
      let dist = gift(start);
      let thrillLeft = owned;
      for (const entry of odds) {
        if (thrillLeft >= 1) {
          thrillLeft -= 1;
          entry.thrill += weight * dist.reduce((sum, mass) => sum + mass, 0);
          dist = gift(dist);
          continue;
        }
        const paid = new Array<number>(max + 1).fill(0);
        dist.forEach((mass, points) => {
          if (points >= 1) paid[points - 1] = (paid[points - 1] ?? 0) + mass;
        });
        const going = paid.reduce((sum, mass) => sum + mass, 0);
        if (going <= 1e-9) break;
        entry.sp += weight * going;
        dist = gift(paid);
      }
    }
  }
  return odds;
}

/** Sparxie — Elation, Fire. */
export default defineCharacter("1501", (k) => {
  const elationCount = k.countPath("Elation");
  const tier = Math.min(3, Math.max(1, elationCount));

  const livestream = k.status({ id: "livestream", origin: "skill" });

  const banger = (ctx: BattleApi) => ctx.self.certifiedBanger();

  // Team buffs per Punchline owned (U6): stacks follow the Punchline.
  const syncWithPunchline = (
    origin: EffectOrigin,
    status: StatusDef,
    max: number
  ) => {
    const sync = (ctx: BattleApi) => {
      const stacks = Math.min(max, ctx.teamResource("punchline"));
      for (const ally of ctx.allies) {
        if (stacks <= 1e-9) ctx.removeStatus(ally, status);
        else if (ally.has(status)) ctx.setStatusStacks(ally, status, stacks);
        else ctx.applyStatus(ally, status, { setStacks: stacks });
      }
    };
    k.on(
      "teamResourceChanged",
      origin,
      { subject: "any", resource: "punchline" },
      sync
    );
    // The Aha Instant clears Punchline without a resource event.
    k.on("ahaInstantEnd", origin, { subject: "any" }, sync);
  };
  if (k.a(3)) {
    const max = Math.round(k.traceParam(3, 2) / k.traceParam(3, 1));
    const palette = k.status({
      id: "palette-of-truth-and-lies",
      origin: "a6",
      maxStacks: max,
      modifiers: [{ stat: "critDmg", value: k.traceParam(3, 1) }],
    });
    syncWithPunchline("a6", palette, max);
  }
  if (k.e(1)) {
    const max = Math.round(k.rankParam(1, 3) / k.rankParam(1, 2));
    const goingViral = k.status({
      id: "going-viral",
      origin: "e1",
      maxStacks: max,
      modifiers: [{ stat: "resPen", value: k.rankParam(1, 2) }],
    });
    syncWithPunchline("e1", goingViral, max);
  }

  if (k.a(1)) {
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "atk",
        threshold: k.traceParam(1, 1),
        step: k.traceParam(1, 2),
        ratio: k.traceParam(1, 3),
        cap: k.traceParam(1, 4),
      },
    });
  }
  if (k.e(6)) k.stat("e6", { stat: "resPen", value: k.rankParam(6, 3) });

  const thrillCrit = k.status({
    id: "audience-knows",
    origin: "e2",
    duration: { turns: k.rankParam(2, 3) },
    maxStacks: k.rankParam(2, 4),
    modifiers: [{ stat: "critDmg", value: k.rankParam(2, 2) }],
  });
  const spendThrill = (ctx: BattleApi) => {
    ctx.addCounter(ctx.self, THRILL, -1);
    if (k.e(2)) ctx.applyStatus(ctx.self, thrillCrit, { stacks: ctx.weight });
  };

  // "Randomly gains one of the following gifts": equal odds assumed, so
  // each trigger yields the average of Straight Fire and Unreal Banger.
  const farmGift = (ctx: BattleApi) => {
    ctx.addCounter(ctx.self, FARMS, 1);
    ctx.gainSkillPoints(k.param("09", 1) / 2);
    ctx.addTeamResource("punchline", (k.param("09", 3) + k.param("09", 2)) / 2);
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // "Not considered as using a Skill": the livestream abilities are `other`
  // so Skill triggers of teammates ignore them; their SP cost is explicit.
  const startLivestream = (ctx: BattleApi) => {
    const skillPoints = ctx.skillPoints;
    ctx.applyStatus(ctx.self, livestream);
    ctx.setCounter(ctx.self, FARMS, 0);
    farmGift(ctx);
    const odds = farmingOdds(
      skillPoints,
      ctx.self.counter(THRILL),
      ctx.maxSkillPoints,
      k.param("02", 1) - 1,
      k.param("09", 1)
    );
    for (const { thrill, sp } of odds) {
      if (thrill > 1e-6) {
        ctx.queueAction(ctx.self, "farmThrill", { weight: thrill });
      }
      if (sp > 1e-6) ctx.queueAction(ctx.self, "farm", { weight: sp });
    }
  };
  k.ability({
    id: "skill",
    kind: "other",
    origin: "skill",
    target: "self",
    skillPoints: -1,
    energy: 0,
    endsTurn: false,
    after: startLivestream,
  });
  k.ability({
    id: "skillThrill",
    kind: "other",
    origin: "skill",
    target: "self",
    skillPoints: 0,
    energy: 0,
    endsTurn: false,
    usable: (view) => view.self.counter(THRILL) >= 1,
    before: spendThrill,
    after: startLivestream,
  });
  k.ability({
    id: "farm",
    kind: "other",
    origin: "skill",
    target: "self",
    skillPoints: -1,
    energy: 0,
    after: farmGift,
  });
  k.ability({
    id: "farmThrill",
    kind: "other",
    origin: "skill",
    target: "self",
    skillPoints: 0,
    energy: 0,
    before: spendThrill,
    after: farmGift,
  });

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    energy: 40,
    hits: (ctx) => {
      const farms = ctx.self.counter(FARMS);
      const hits: HitDef[] = [
        {
          shape: "blast",
          main: k.param("08", 1) + farms * k.param("09", 4),
          adjacent: k.param("08", 2) + farms * k.param("09", 5),
          toughness: { main: 10, adjacent: 5 },
        },
      ];
      if (banger(ctx) > 0) {
        // Talent facts list 5 Toughness on the main target only.
        hits.push({
          shape: "blast",
          main: k.param("04", 3),
          adjacent: k.param("04", 4),
          kind: "elation",
          onlyTags: ["elation"],
          punchline: banger(ctx),
          toughness: { main: 5 },
        });
      }
      return hits;
    },
    after: (ctx) => {
      const farms = ctx.self.counter(FARMS);
      if (banger(ctx) > 0 && farms > 0) {
        ctx.deal(
          {
            shape: "bounce",
            each: k.param("04", 1),
            bounces: farms,
            kind: "elation",
            onlyTags: ["elation"],
            punchline: banger(ctx),
          },
          { targets: ctx.targetsHit() }
        );
      }
      ctx.setCounter(ctx.self, FARMS, 0);
      ctx.removeStatus(ctx.self, livestream);
    },
  });

  const lockedIn = k.status({
    id: "locked-in",
    origin: "e4",
    duration: { turns: k.rankParam(4, 3) },
    modifiers: [{ stat: "elation", value: k.rankParam(4, 2) }],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      let punchline = k.param("03", 1);
      if (k.a(2)) {
        punchline += k.traceParam(2, tier);
        ctx.addCounter(ctx.self, THRILL, k.traceParam(2, tier + 3));
      }
      if (k.e(4)) {
        punchline += k.rankParam(4, 1);
        ctx.applyStatus(ctx.self, lockedIn);
      }
      ctx.addTeamResource("punchline", punchline);
    },
    hits: (ctx) => {
      const hits: HitDef[] = [
        {
          shape: "aoe",
          each: k.param("03", 2),
          elationScaling: k.param("03", 3),
          toughness: { each: 20 },
        },
      ];
      if (banger(ctx) > 0) {
        hits.push({
          shape: "aoe",
          each: k.param("04", 2),
          kind: "elation",
          onlyTags: ["elation"],
          punchline: banger(ctx),
        });
      }
      return hits;
    },
  });

  // Facts: 6.67 Toughness per enemy for the AoE part and 1.67 per random
  // instance (the Bounce convention puts per-instance Toughness first).
  k.ability({
    id: "elationSkill",
    kind: "elationSkill",
    hits: (ctx) => {
      let instances = k.param("20", 3);
      if (k.e(6)) {
        instances = Math.min(
          k.rankParam(6, 2),
          instances +
            Math.floor(ctx.teamResource("punchline") / k.rankParam(6, 1))
        );
      }
      return [
        {
          shape: "aoe",
          each: k.param("20", 2),
          kind: "elation",
          toughness: { each: 20 / 3 },
        },
        {
          shape: "bounce",
          each: k.param("20", 1),
          bounces: instances,
          kind: "elation",
          toughness: { each: 5 / 3 },
        },
      ];
    },
    after: (ctx) => ctx.addCounter(ctx.self, THRILL, k.param("20", 4)),
  });

  if (k.e(1)) {
    k.on("ahaInstantEnd", "e1", { subject: "any" }, (ctx) =>
      ctx.addTeamResource("punchline", k.rankParam(1, 1))
    );
  }
  if (k.e(2)) {
    k.on("ahaInstantEnd", "e2", { subject: "any" }, (ctx) => {
      ctx.grantExtraTurn(ctx.self);
      ctx.addCounter(ctx.self, THRILL, k.rankParam(2, 1));
    });
  }

  // Sparxie streams every turn she can pay for: Skill, farm while Thrill or
  // SP last (see farmingOdds), then finalize with the Enhanced Basic ATK.
  k.policy({
    turn: (view) => {
      if (view.self.has(livestream)) return "enhancedBasic";
      if (view.self.counter(THRILL) >= 1) return "skillThrill";
      return view.skillPoints >= 1 ? "skill" : "basic";
    },
  });
});
