import type { BattleApi, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Aventurine • Waveflair — Elation, Quantum. */
export default defineCharacter("1513", (k) => {
  const PUNCHLINE = "punchline";
  const FERVOR = "fervor";
  const A6_TRIGGERS = "a6-triggers";
  const ELATION_USES = "elation-skill-uses";
  const fervorMax = k.e(2) ? k.rankParam(2, 1) : k.param("04", 4);
  // Talent: Cheers at 10 Fervor; E1 "10/20/30 points" and E2 "40/50 points"
  // (no placeholders).
  const thresholds = [
    k.param("04", 1),
    ...(k.e(1) ? [20, 30] : []),
    ...(k.e(2) ? [40, 50] : []),
  ];
  // Talent: "The duration of ... Certified Banger increases by 1 turn".
  const bangerTurns = 3;
  const solo = k.countPath("Elation") <= 1;

  if (k.a(1)) {
    // "When SPD is 140 or higher, +30%; +1% per SPD exceeded, up to 200".
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.traceParam(1, 1),
        ratio: k.traceParam(1, 2),
      },
    });
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "spd",
        threshold: k.traceParam(1, 1),
        step: k.traceParam(1, 3),
        ratio: k.traceParam(1, 4),
        cap: k.traceParam(1, 4) * k.traceParam(1, 5),
      },
    });
  }
  if (k.a(2) && !solo) {
    k.teamStat("a4", { stat: "elation", value: k.traceParam(2, 5) });
    k.stat("a4", { stat: "elation", value: k.traceParam(2, 1) });
  }
  if (k.a(3)) k.stat("a6", { stat: "critDmg", value: k.traceParam(3, 1) });
  if (k.e(1)) k.stat("e1", { stat: "resPen", value: k.rankParam(1, 1) });
  if (k.e(6)) k.stat("e6", { stat: "merrymaking", value: k.rankParam(6, 2) });

  const allInReady = k.status({ id: "all-in-ready", origin: "talent" });
  const ultimateSpeed = k.status({
    id: "grand-slam-spd",
    origin: "ultimate",
    duration: { turns: k.param("03", 5) },
    modifiers: [{ stat: "spdPct", value: k.param("03", 4) }],
  });
  const a6CritDmg = k.status({
    id: "sift-through-gilded-dreams",
    origin: "a6",
    duration: { turns: k.traceParam(3, 3) },
    modifiers: [{ stat: "critDmg", value: k.traceParam(3, 2) }],
  });
  const e4DefIgnore = k.status({
    id: "sunlight-runs-no-tab",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "defIgnore", value: k.rankParam(4, 1) }],
  });

  /** Fervor; crossing a threshold uses "Cheers! To Summer's Blaze". */
  const gainFervor = (ctx: BattleApi, amount: number) => {
    const before = ctx.self.counter(FERVOR);
    ctx.addCounter(ctx.self, FERVOR, amount, fervorMax);
    const after = ctx.self.counter(FERVOR);
    for (const threshold of thresholds) {
      if (before < threshold - 1e-9 && after >= threshold - 1e-9) {
        ctx.queueAction(ctx.self, "talentCheers", { weight: 1 / ctx.weight });
      }
    }
  };

  const bangerHit = (ctx: BattleApi, multiplier: number): HitDef[] => {
    const banger = ctx.self.certifiedBanger();
    return banger > 0
      ? [
          {
            shape: "aoe",
            each: multiplier,
            kind: "elation",
            punchline: banger,
          },
        ]
      : [];
  };

  const cheersHits = (punchline?: number): HitDef[] => {
    const fixed = punchline === undefined ? {} : { punchline };
    return [
      {
        shape: "aoe",
        each: k.param("20", 1),
        kind: "elation",
        toughness: { each: 10 },
        ...fixed,
      },
      // Facts: 3.33 Toughness per bounce.
      {
        shape: "bounce",
        each: k.param("20", 3),
        bounces: k.param("20", 2),
        kind: "elation",
        toughness: { each: 10 / 3 },
        ...fixed,
      },
    ];
  };
  const allInHits = (fervor: number, punchline?: number): HitDef[] => {
    const fixed = punchline === undefined ? {} : { punchline };
    const hits: HitDef[] = [
      {
        shape: "aoe",
        each: k.param("21", 1),
        kind: "elation",
        toughness: { each: 20 },
        ...fixed,
      },
      {
        shape: "bounce",
        each: k.param("21", 4),
        bounces: k.param("21", 3),
        kind: "elation",
        toughness: { each: 5 },
        ...fixed,
      },
    ];
    // The Fervor bounces are read as the same instances (5 Toughness each).
    if (fervor > 1e-9) {
      hits.push({
        shape: "bounce",
        each: k.param("21", 2),
        bounces: fervor,
        kind: "elation",
        toughness: { each: 5 },
        ...fixed,
      });
    }
    return hits;
  };

  const e6AllIn = (unit: UnitView) =>
    k.e(6) && unit.counter(ELATION_USES) >= k.rankParam(6, 1) - 1e-9;
  const afterElationSkill = (ctx: BattleApi) => {
    ctx.addCounter(ctx.self, ELATION_USES, 1);
    if (k.e(2)) gainFervor(ctx, k.rankParam(2, 2));
  };
  // A4 alone: "considered as having launched Follow-Up ATK".
  const followUpTags = k.a(2) && solo ? { tags: ["followUp" as const] } : {};

  // Elation Skill in the Aha Instant: All In after the Talent's Cheers (or
  // always after E6's 2 uses), consuming all Fervor.
  k.ability({
    id: "elationSkill",
    kind: "elationSkill",
    ...followUpTags,
    before: (ctx) => {
      const allIn = ctx.self.has(allInReady) || e6AllIn(ctx.self);
      ctx.scratch.set("allIn", allIn);
      if (!allIn) return;
      ctx.scratch.set("fervor", ctx.self.counter(FERVOR));
      ctx.setCounter(ctx.self, FERVOR, 0);
      ctx.removeStatus(ctx.self, allInReady);
    },
    hits: (ctx) =>
      ctx.scratch.get("allIn")
        ? allInHits(Number(ctx.scratch.get("fervor") ?? 0))
        : cheersHits(),
    after: afterElationSkill,
  });

  // Talent: Cheers outside the Aha Instant with a fixed 20 Punchline. At E6
  // it is All In and keeps the Fervor.
  k.ability({
    id: "talentCheers",
    kind: "elationSkill",
    ...followUpTags,
    hits: (ctx) =>
      e6AllIn(ctx.self)
        ? allInHits(ctx.self.counter(FERVOR), k.param("04", 5))
        : cheersHits(k.param("04", 5)),
    after: (ctx) => {
      ctx.applyStatus(ctx.self, allInReady);
      afterElationSkill(ctx);
    },
  });

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
    before: (ctx) => {
      ctx.setCounter(ctx.self, A6_TRIGGERS, 0);
      if (k.e(4)) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, e4DefIgnore);
      }
    },
    hits: (ctx) => [
      { shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } },
      ...bangerHit(ctx, k.param("04", 2)),
    ],
    after: (ctx) => {
      ctx.addTeamResource(PUNCHLINE, k.param("02", 2));
      gainFervor(ctx, k.param("02", 3));
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: (ctx) => [
      { shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } },
      ...bangerHit(ctx, k.param("04", 3)),
    ],
    after: (ctx) => {
      ctx.addTeamResource(PUNCHLINE, k.param("03", 3));
      gainFervor(ctx, k.param("03", 2));
      ctx.applyStatus(ctx.self, ultimateSpeed);
    },
  });

  k.on("actionEnd", "talent", { subject: "otherAlly", attack: true }, (ctx) => {
    ctx.addTeamResource(PUNCHLINE, k.param("04", 6));
    gainFervor(ctx, k.param("04", 7));
    // A4 alone; Aha's SPD +25 is not modeled (tracked).
    if (k.a(2) && solo) {
      ctx.grantCertifiedBanger(ctx.self, k.traceParam(2, 2), bangerTurns);
      ctx.addTeamResource(PUNCHLINE, k.traceParam(2, 4));
    }
  });

  if (k.a(3)) {
    k.on(
      "actionEnd",
      "a6",
      {
        subject: "otherAlly",
        abilityKinds: ["basic", "skill", "followUp", "ultimate"],
        when: (_event, self) =>
          self.counter(A6_TRIGGERS) < k.traceParam(3, 5) - 1e-9,
      },
      (ctx) => {
        for (const ally of ctx.allies) ctx.applyStatus(ally, a6CritDmg);
        gainFervor(ctx, k.traceParam(3, 4));
        ctx.addCounter(ctx.self, A6_TRIGGERS, 1);
      }
    );
  }
});
