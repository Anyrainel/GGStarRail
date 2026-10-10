import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** March 7th — Preservation, Ice. */
export default defineCharacter("1001", (k) => {
  // Shield amounts are not modelled (U12); the statuses carry the Shields'
  // durations so "Shielded" checks see them.
  const cuteness = k.status({
    id: "power-of-cuteness",
    origin: "skill",
    family: "shield",
    duration: {
      turns: k.param("02", 2) + (k.a(2) ? k.traceParam(2, 1) : 0),
    },
  });
  // "Greatly increases the chance of enemies attacking that ally" while its
  // HP is at #3 or higher: #5 of the Skill (5, i.e. +500%) is that aggro
  // increase, absent from the text.
  const cutenessLure = k.status({
    id: "power-of-cuteness-lure",
    origin: "skill",
    modifiers: [{ stat: "aggroPct", value: k.param("02", 5) }],
  });
  const e2Shield = k.status({
    id: "e2-shield",
    origin: "e2",
    family: "shield",
    duration: { turns: k.rankParam(2, 2) },
  });
  // The lure lasts as long as the Skill's Shield, and only while HP is high.
  const syncLure = (ctx: BattleApi, unit: UnitView) => {
    const lured =
      unit.has(cuteness, ctx.self) && unit.hpRatio >= k.param("02", 3) - 1e-9;
    if (lured && !unit.has(cutenessLure, ctx.self)) {
      ctx.applyStatus(unit, cutenessLure);
    } else if (!lured && unit.has(cutenessLure, ctx.self)) {
      ctx.removeStatus(unit, cutenessLure);
    }
  };

  const freezeChance = k.param("03", 2) + (k.a(3) ? k.traceParam(3, 1) : 0);
  const freeze = k.status({
    id: "freeze",
    origin: "ultimate",
    debuff: true,
    family: "frozen",
    skipsTurn: true,
    duration: { turns: k.param("03", 3) },
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
    target: "ally",
    after: (ctx) => {
      const ally = ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;
      ctx.applyStatus(ally, cuteness);
      syncLure(ctx, ally);
    },
  });

  k.on(
    "hpChanged",
    "skill",
    { subject: "ally", when: (event, self) => event.unit.has(cuteness, self) },
    (ctx, event) => syncLure(ctx, event.unit)
  );
  k.on("statusRemoved", "skill", { status: cuteness }, (ctx, event) => {
    if (event.target) syncLure(ctx, event.target);
  });

  // The engine skips a Frozen enemy's turn with the base chance (Effect Hit
  // Rate is not read for the timeline); E1 Energy and the turn-start DMG use
  // the same expected chance (tracker engine-control-turn-start-dmg).
  const frozenWeight = Math.min(1, freezeChance);
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      for (const enemy of ctx.targetsHit()) {
        ctx.applyStatus(enemy, freeze, { baseChance: freezeChance });
        if (k.e(1)) {
          ctx.gainEnergy(ctx.self, k.rankParam(1, 1) * frozenWeight);
        }
      }
    },
  });

  k.on(
    "turnStart",
    "ultimate",
    {
      subject: "enemy",
      when: (event, self) => event.unit.has(freeze, self),
    },
    (ctx, event) => {
      if (!isEnemy(event.unit)) return;
      ctx.deal(
        { shape: "single", main: k.param("03", 4), onlyTags: ["additional"] },
        {
          targets: [event.unit],
          abilityId: "freeze",
          origin: "ultimate",
          weight: frozenWeight,
        }
      );
    }
  );

  // Counter: a Follow-Up ATK. E4 adds DMG equal to 30% of DEF to it.
  const counterHits: HitDef[] = [
    { shape: "single", main: k.param("04", 1), toughness: { main: 10 } },
  ];
  if (k.e(4)) {
    counterHits.push({
      shape: "single",
      stat: "def",
      main: k.rankParam(4, 1),
      silent: true,
    });
  }
  k.ability({ id: "counter", kind: "followUp", energy: 10, hits: counterHits });

  // E4: "can be triggered 1 more time in each turn" (no placeholder).
  const countersPerTurn = k.param("04", 2) + (k.e(4) ? 1 : 0);
  k.on(
    "hitByEnemy",
    "talent",
    {
      subject: "ally",
      // Shields from any source.
      when: (event) => event.unit.hasFamily("shield"),
      limitPerTurn: countersPerTurn,
    },
    (ctx, event) => {
      if (!isEnemy(event.target)) return;
      ctx.queueAction(ctx.self, "counter", { target: event.target });
    }
  );

  if (k.e(2)) {
    // The ally with the lowest HP share; ties (every ally starts at full HP)
    // fall on March 7th herself.
    k.on("battleStart", "e2", { subject: "any" }, (ctx) => {
      const lowest = ctx.allies.reduce(
        (best, ally) => (ally.hpRatio < best.hpRatio - 1e-9 ? ally : best),
        ctx.self
      );
      ctx.applyStatus(lowest, e2Shield);
    });
  }

  if (k.e(6)) {
    // Allies under the Skill's Shield restore #1 of their Max HP plus #2 at
    // the start of each of their turns.
    k.on(
      "turnStart",
      "e6",
      {
        subject: "ally",
        when: (event, self) => event.unit.has(cuteness, self),
      },
      (ctx, event) => {
        const maxHp = event.unit.panelStat("hp");
        if (maxHp <= 0) return;
        const boost = 1 + ctx.self.currentStat("outgoingHealing");
        const amount = k.rankParam(6, 1) * maxHp + k.rankParam(6, 2);
        ctx.heal(event.unit, (amount * boost) / maxHp);
      }
    );
  }

  // Shield herself (the tank: the lure keeps enemy attacks, and Counters, on
  // her) whenever her Skill's Shield is gone; Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      view.skillPoints >= 1 && !view.self.has(cuteness)
        ? { ability: "skill", target: view.self }
        : "basic",
  });
});
