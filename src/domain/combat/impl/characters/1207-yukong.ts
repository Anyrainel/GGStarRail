import type { BattleApi, BattleEvent } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Yukong — Harmony, Imaginary. */
export default defineCharacter("1207", (k) => {
  const SKILL_TURN = "skill-turn";
  const ENHANCED = "enhanced";
  const e2Used = (id: string) => `e2:${id}`;

  // "to a maximum of 2 stacks" has no placeholder.
  const maxBowstrings = 2;
  const bowstrings = k.status({
    id: "roaring-bowstrings",
    origin: "skill",
    maxStacks: maxBowstrings,
  });
  const bowstringsAtk = k.status({
    id: "roaring-bowstrings-atk",
    origin: "skill",
    modifiers: [{ stat: "atkPct", value: k.param("02", 2) }],
  });
  // The Ultimate's CRIT bonus is part of Roaring Bowstrings and ends with it.
  const divingKestrel = k.status({
    id: "diving-kestrel",
    origin: "ultimate",
    modifiers: [
      { stat: "critRate", value: k.param("03", 2) },
      { stat: "critDmg", value: k.param("03", 3) },
    ],
  });
  const e4Boost = k.status({
    id: "e4-dmg",
    origin: "e4",
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(4, 1) }],
  });
  const talentCooldown = k.status({
    id: "seven-layers-cooldown",
    origin: "talent",
    duration: { turns: k.param("04", 3) },
  });

  if (k.a(2)) {
    k.teamStat("a4", {
      stat: "dmgBoost",
      value: k.traceParam(2, 1),
      filter: { combatTypes: ["Imaginary"] },
    });
  }

  const syncBowstrings = (ctx: BattleApi) => {
    const active = ctx.self.has(bowstrings);
    for (const ally of ctx.allies) {
      if (!active) {
        ctx.removeStatus(ally, bowstringsAtk);
        ctx.removeStatus(ally, divingKestrel);
      } else if (!ally.has(bowstringsAtk)) {
        ctx.applyStatus(ally, bowstringsAtk);
      }
    }
    if (k.e(4)) {
      if (!active) ctx.removeStatus(ctx.self, e4Boost);
      else if (!ctx.self.has(e4Boost)) ctx.applyStatus(ctx.self, e4Boost);
    }
  };

  // "Ally" turns and actions are those of ally targets: Characters and
  // memosprites, not countdowns or other summons.
  const isAllyTarget = (event: BattleEvent) => event.unit.kind !== "summon";

  k.on(
    "turnEnd",
    "skill",
    { subject: "ally", when: isAllyTarget },
    (ctx, event) => {
      if (event.unit === ctx.self && ctx.self.counter(SKILL_TURN) > 0) {
        ctx.setCounter(ctx.self, SKILL_TURN, 0);
        return;
      }
      if (!ctx.self.has(bowstrings)) return;
      ctx.consumeStacks(ctx.self, bowstrings, 1);
      syncBowstrings(ctx);
    }
  );

  if (k.a(3)) {
    k.on(
      "actionEnd",
      "a6",
      {
        subject: "ally",
        when: (event, self) => isAllyTarget(event) && self.has(bowstrings),
      },
      (ctx) => ctx.gainEnergy(ctx.self, k.traceParam(3, 1))
    );
  }

  if (k.e(1)) {
    const aerialMarshal = k.status({
      id: "e1-spd",
      origin: "e1",
      duration: { turns: k.rankParam(1, 2) },
      modifiers: [{ stat: "spdPct", value: k.rankParam(1, 1) }],
    });
    k.on("battleStart", "e1", { subject: "any" }, (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, aerialMarshal);
    });
  }

  if (k.e(2)) {
    // When a gain fills an ally's Energy (gains at the cap change nothing).
    // Energy is an expected value that fills, and lets Ultimates cast,
    // deterministically, so a filling gain of any probability triggers it
    // in full.
    k.on(
      "energyGained",
      "e2",
      {
        subject: "ally",
        when: (event, self) =>
          (event.delta ?? 0) > 1e-9 &&
          event.unit.maxEnergy > 0 &&
          event.unit.energy >= event.unit.maxEnergy - 1e-6 &&
          self.counter(e2Used(event.unit.id)) <= 0,
      },
      (ctx, event) => {
        ctx.setCounter(ctx.self, e2Used(event.unit.id), 1);
        ctx.gainEnergy(ctx.self, k.rankParam(2, 1) / ctx.weight);
      }
    );
  }

  // The Talent raises this attack's multiplier and Toughness Reduction; it
  // is read as one damage instance.
  k.ability({
    id: "basic",
    kind: "basic",
    before: (ctx) => ctx.scratch.set(ENHANCED, !ctx.self.has(talentCooldown)),
    hits: (ctx) => {
      const enhanced = ctx.scratch.get(ENHANCED) === true;
      return [
        {
          shape: "single",
          main: k.param("01", 1) + (enhanced ? k.param("04", 1) : 0),
          toughness: { main: 10 * (enhanced ? 1 + k.param("04", 2) : 1) },
        },
      ];
    },
    after: (ctx) => {
      if (ctx.scratch.get(ENHANCED) === true) {
        ctx.applyStatus(ctx.self, talentCooldown);
      }
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "allies",
    after: (ctx) => {
      ctx.applyStatus(ctx.self, bowstrings, { stacks: k.param("02", 1) });
      ctx.setCounter(ctx.self, SKILL_TURN, 1);
      syncBowstrings(ctx);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    before: (ctx) => {
      if (k.e(6)) {
        ctx.applyStatus(ctx.self, bowstrings, { stacks: k.rankParam(6, 1) });
      }
      if (ctx.self.has(bowstrings)) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, divingKestrel);
      }
      syncBowstrings(ctx);
    },
    after: (ctx) => {
      if (!k.e(2)) return;
      for (const ally of ctx.allies)
        ctx.setCounter(ctx.self, e2Used(ally.id), 0);
    },
  });

  k.policy({
    // Skill whenever Roaring Bowstrings would not outlast her own turn end;
    // the Ultimate waits for Roaring Bowstrings (E6 grants a stack first).
    turn: (view) =>
      view.skillPoints >= 1 && view.self.stacks(bowstrings) < maxBowstrings
        ? "skill"
        : "basic",
    ultimate: (view) => k.e(6) || view.self.has(bowstrings),
  });
});
