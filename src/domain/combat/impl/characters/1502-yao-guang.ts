import { type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const SP_SPENT = "great-boon-sp-spent";
/** The Ultimate queued Aha's extra turn (E4 applies in that turn). */
const E4_PENDING = "e4-extra-turn-pending";
const E4_ACTIVE = "e4-extra-turn-active";

/** Yao Guang — Elation, Physical. */
export default defineCharacter("1502", (k) => {
  const zoneModifiers: ModifierDef[] = [
    {
      stat: "elation",
      scaling: { source: "applier", stat: "elation", ratio: k.param("02", 2) },
    },
  ];
  if (k.a(1)) {
    // A2's Elation scales with SPD, and scaling never reads other scaling,
    // so the Zone shares that part through the same SPD terms (linear).
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
        cap: (k.traceParam(1, 5) / k.traceParam(1, 3)) * k.traceParam(1, 4),
      },
    });
    zoneModifiers.push(
      {
        stat: "elation",
        scaling: {
          source: "applier",
          stat: "spd",
          atLeast: k.traceParam(1, 1),
          ratio: k.param("02", 2) * k.traceParam(1, 2),
        },
      },
      {
        stat: "elation",
        scaling: {
          source: "applier",
          stat: "spd",
          threshold: k.traceParam(1, 1),
          step: k.traceParam(1, 3),
          ratio: k.param("02", 2) * k.traceParam(1, 4),
          cap:
            k.param("02", 2) *
            (k.traceParam(1, 5) / k.traceParam(1, 3)) *
            k.traceParam(1, 4),
        },
      }
    );
  }
  if (k.e(2)) {
    zoneModifiers.push(
      { stat: "spdPct", value: k.rankParam(2, 2) },
      { stat: "elation", value: k.rankParam(2, 1) }
    );
  }
  const zone = k.status({
    id: "decalight-zone",
    origin: "skill",
    duration: {
      turns: k.param("02", 1),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: zoneModifiers,
  });

  const resPen = k.status({
    id: "hexagram-res-pen",
    origin: "ultimate",
    duration: { turns: k.param("03", 3) },
    modifiers: [{ stat: "resPen", value: k.param("03", 2) }],
  });

  const woesWhisper = k.status({
    id: "woes-whisper",
    origin: "elationSkill",
    debuff: true,
    duration: { turns: k.param("20", 4) },
    modifiers: [{ stat: "vulnerability", value: k.param("20", 3) }],
  });

  if (k.a(2)) k.stat("a4", { stat: "critDmg", value: k.traceParam(2, 4) });
  if (k.e(1)) {
    k.teamStat("e1", {
      stat: "defIgnore",
      value: k.rankParam(1, 1),
      filter: { tags: ["elation"] },
    });
  }
  if (k.e(6))
    k.teamStat("e6", { stat: "merrymaking", value: k.rankParam(6, 1) });

  // The Zone's Elation is a halo effect in game: memosprites summoned while
  // it lasts receive it for the remaining duration.
  k.on(
    "summoned",
    "skill",
    { subject: "ally", when: (event) => event.unit.kind === "memosprite" },
    (ctx, event) => {
      const turns = ctx.self.remainingTurns(zone);
      if (turns) ctx.applyStatus(event.unit, zone, { turns });
    }
  );

  const zonePunchline = (ctx: BattleApi) => {
    if (ctx.self.has(zone)) {
      ctx.addTeamResource("punchline", k.param("02", 3));
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    energy: 30,
    hits: [
      {
        shape: "blast",
        main: k.param("01", 1),
        adjacent: k.param("01", 2),
        toughness: { main: 10, adjacent: 5 },
      },
    ],
    after: zonePunchline,
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, zone);
    },
    after: zonePunchline,
  });

  // Aha's extra turn counts a fixed Punchline without consuming any. A6's
  // +1 turn cannot reach the Certified Banger the engine grants in it
  // (tracked: yao-guang-a6-banger-duration).
  const fixedPunchline = k.e(1) ? k.rankParam(1, 2) : k.param("03", 4);
  const featheredFortune = k.status({
    id: "threads-of-fate",
    origin: "e4",
    modifiers: [
      {
        stat: "dmgMultiplier",
        value: k.rankParam(4, 1) - 1,
        filter: { tags: ["elation"] },
      },
    ],
  });
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      ctx.addTeamResource("punchline", k.param("03", 1));
      for (const ally of ctx.allies) ctx.applyStatus(ally, resPen);
    },
    after: (ctx) => {
      if (k.e(4)) ctx.setCounter(ctx.self, E4_PENDING, 1);
      ctx.ahaExtraTurn(fixedPunchline);
    },
  });

  if (k.e(4)) {
    // No tag separates Elation Skill DMG, so other Elation DMG dealt inside
    // the extra turn (Great Boon) is boosted too.
    k.on(
      "ahaInstantStart",
      "e4",
      {
        subject: "any",
        when: (event, self) =>
          event.extraTurn === true && self.counter(E4_PENDING) > 0,
      },
      (ctx) => {
        ctx.setCounter(ctx.self, E4_PENDING, 0);
        ctx.setCounter(ctx.self, E4_ACTIVE, 1);
        for (const ally of ctx.allies) {
          if (ally.kind === "character") {
            ctx.applyStatus(ally, featheredFortune);
          }
        }
      }
    );
    k.on(
      "ahaInstantEnd",
      "e4",
      { subject: "any", when: (_event, self) => self.counter(E4_ACTIVE) > 0 },
      (ctx) => {
        ctx.setCounter(ctx.self, E4_ACTIVE, 0);
        for (const ally of ctx.allies) ctx.removeStatus(ally, featheredFortune);
      }
    );
  }

  // Great Boon: one extra instance after an ally attack, two when the
  // attack consumed Skill Points. Dealt with Yao Guang's stats (her Elation
  // is the one the text substitutes when higher) and the attacker's Type.
  k.on(
    "skillPointsChanged",
    "talent",
    { subject: "ally", when: (event) => (event.delta ?? 0) < 0 },
    (ctx) => ctx.setCounter(ctx.self, SP_SPENT, 1)
  );
  k.on(
    "actionEnd",
    "talent",
    {
      subject: "ally",
      attack: true,
      when: (_event, self) => self.certifiedBanger() > 0,
    },
    (ctx, event) => {
      const targets = (event.targetsHit ?? []).filter(isEnemy);
      if (targets.length === 0) return;
      ctx.deal(
        {
          shape: "bounce",
          each: k.param("04", 1),
          bounces: 1 + ctx.self.counter(SP_SPENT),
          kind: "elation",
          combatType: event.unit.combatType,
          onlyTags: ["elation"],
          punchline: ctx.self.certifiedBanger(),
        },
        { targets, abilityId: "greatBoon" }
      );
    }
  );
  k.on("actionEnd", "talent", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, SP_SPENT, 0)
  );

  // E6 raises the multiplier itself (not the DMG multiplier zone), so it
  // compounds with E4's "becomes 150% of the original DMG".
  const elationSkillScale = k.e(6) ? 1 + k.rankParam(6, 2) : 1;
  k.ability({
    id: "elationSkill",
    kind: "elationSkill",
    before: (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, woesWhisper);
    },
    // Facts: 20 Toughness per enemy for the AoE part and 5 per random
    // instance (the Bounce convention puts per-instance Toughness first).
    hits: [
      {
        shape: "aoe",
        each: k.param("20", 2) * elationSkillScale,
        kind: "elation",
        toughness: { each: 20 },
      },
      {
        shape: "bounce",
        each: k.param("20", 6) * elationSkillScale,
        bounces: k.param("20", 5),
        kind: "elation",
        toughness: { each: 5 },
      },
    ],
    after: (ctx) => {
      if (k.a(2)) ctx.gainSkillPoints(k.traceParam(2, 1));
    },
  });

  // Support: Skill only to (re)deploy the Zone, Basic ATK otherwise.
  k.policy({
    turn: (view) => (view.self.has(zone) ? "basic" : "skill"),
  });
});
