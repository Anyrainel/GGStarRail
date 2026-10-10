import { isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** March 7th — Preservation, Ice. */
export default defineCharacter("1001", (k) => {
  // Shields and the Skill's taunt are not modelled (U12): these statuses only
  // mark the "Shielded" allies the Talent's Counter reacts to (tracker
  // engine-shield-state).
  const cuteness = k.status({
    id: "power-of-cuteness",
    origin: "skill",
    duration: {
      turns: k.param("02", 2) + (k.a(2) ? k.traceParam(2, 1) : 0),
    },
  });
  const e2Shield = k.status({
    id: "e2-shield",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
  });
  const shielded = (unit: UnitView) => unit.has(cuteness) || unit.has(e2Shield);

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
    },
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
      when: (event) => shielded(event.unit),
      limitPerTurn: countersPerTurn,
    },
    (ctx, event) => {
      if (!isEnemy(event.target)) return;
      ctx.queueAction(ctx.self, "counter", { target: event.target });
    }
  );

  if (k.e(2)) {
    // All allies are at full HP when battle starts; the lowest-HP tie is
    // assumed to fall on March 7th herself.
    k.on("battleStart", "e2", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, e2Shield)
    );
  }

  // Shield herself (the highest base aggro, so the most Counters while the
  // taunt is not modelled) whenever she has no shield; Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      view.skillPoints >= 1 && !shielded(view.self)
        ? { ability: "skill", target: view.self }
        : "basic",
  });
});
