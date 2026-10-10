import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Aventurine — Preservation, Imaginary. */
export default defineCharacter("1304", (k) => {
  const BET = "blind-bet";
  // "Upon reaching 7 points ... consumes the 7 points"; "capped at 10 points"
  // (no placeholders).
  const BET_THRESHOLD = 7;
  const BET_CAP = 10;

  // Fortified Wager's Shield is not modelled (U12); the status carries the
  // Talent's Effect RES and E1's CRIT DMG and gates the Blind Bet triggers.
  const wagerModifiers: ModifierDef[] = [
    { stat: "effectRes", value: k.param("04", 4) },
  ];
  if (k.e(1)) {
    wagerModifiers.push({ stat: "critDmg", value: k.rankParam(1, 1) });
  }
  const wager = k.status({
    id: "fortified-wager",
    origin: "skill",
    duration: { turns: k.param("02", 3) },
    modifiers: wagerModifiers,
  });
  const grantWager = (ctx: BattleApi, turns: number) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, wager, { turns });
  };

  const unnerved = k.status({
    id: "unnerved",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 4) },
  });
  k.teamStat("ultimate", {
    stat: "critDmg",
    value: k.param("03", 3),
    filter: { targetStatuses: [unnerved.id] },
  });

  const e2Res = k.status({
    id: "bounded-rationality",
    origin: "e2",
    debuff: true,
    duration: { turns: k.rankParam(2, 3) },
    modifiers: [{ stat: "resReduction", value: k.rankParam(2, 2) }],
  });

  const e4Def = k.status({
    id: "unexpected-hanging-paradox",
    origin: "e4",
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "defPct", value: k.rankParam(4, 1) }],
  });

  // E6 counts teammates holding Fortified Wager; other Shields are not
  // modelled (tracker engine-shield-state).
  const e6Boost = k.status({
    id: "stag-hunt-game",
    origin: "e6",
    maxStacks: Math.round(k.rankParam(6, 2) / k.rankParam(6, 1)),
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(6, 1) }],
  });

  if (k.a(1)) {
    // "For every 100 of DEF" (no placeholder).
    k.stat("a2", {
      stat: "critRate",
      scaling: {
        source: "holder",
        stat: "def",
        threshold: k.traceParam(1, 3),
        step: 100,
        ratio: k.traceParam(1, 1),
        cap: k.traceParam(1, 2),
      },
    });
  }

  /**
   * Blind Bet from aggro-weighted or random triggers is an expected amount;
   * each full 7 points launches one whole Follow-Up ATK whatever the weight
   * of the trigger.
   */
  const gainBet = (ctx: BattleApi, points: number) => {
    if (ctx.weight <= 0) return;
    ctx.addCounter(ctx.self, BET, points, BET_CAP);
    while (ctx.self.counter(BET) >= BET_THRESHOLD - 1e-9) {
      ctx.setCounter(ctx.self, BET, ctx.self.counter(BET) - BET_THRESHOLD);
      ctx.queueAction(ctx.self, "followUp", { weight: 1 / ctx.weight });
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    before: (ctx) => {
      if (k.e(2) && isEnemy(ctx.target)) ctx.applyStatus(ctx.target, e2Res);
    },
    hits: [
      {
        shape: "single",
        stat: "def",
        main: k.param("01", 1),
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "allies",
    after: (ctx) => grantWager(ctx, k.param("02", 3)),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      // "Randomly gains 1 to 7 points": the expected 4.
      gainBet(ctx, (1 + k.param("03", 1)) / 2);
      if (isEnemy(ctx.target)) ctx.applyStatus(ctx.target, unnerved);
    },
    hits: [
      {
        shape: "single",
        stat: "def",
        main: k.param("03", 2),
        toughness: { main: 30 },
      },
    ],
    after: (ctx) => {
      if (k.e(1)) grantWager(ctx, k.rankParam(1, 3));
    },
  });

  // Bounce facts list Toughness (10/3) and Energy (1) per hit.
  const followUpHits = k.param("04", 2) + (k.e(4) ? k.rankParam(4, 3) : 0);
  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: followUpHits,
    before: (ctx) => {
      if (k.e(4)) ctx.applyStatus(ctx.self, e4Def);
    },
    hits: [
      {
        shape: "bounce",
        stat: "def",
        each: k.param("04", 3),
        bounces: followUpHits,
        toughness: { each: 10 / 3 },
      },
    ],
    after: (ctx) => {
      // A6: "lasting for 3 turns" (no placeholder).
      if (k.a(3)) grantWager(ctx, 3);
    },
  });

  // A Shielded ally being attacked gives 1 point (no placeholder), and
  // Aventurine himself #1 more. ZH ties his extra point to holding Fortified
  // Wager (砂金持有【坚垣筹码】时……并在受到攻击后额外获得), EN leaves it open.
  k.on(
    "hitByEnemy",
    "talent",
    { subject: "ally", when: (event) => event.unit.has(wager) },
    (ctx, event) =>
      gainBet(ctx, 1 + (event.unit.id === ctx.self.id ? k.param("04", 1) : 0))
  );

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      grantWager(ctx, k.traceParam(2, 1))
    );
  }

  if (k.a(3)) {
    // A summon's Follow-Up ATK is its owner's (Numby for Topaz).
    const holder = (unit: UnitView) =>
      unit.kind === "summon" && unit.owner ? unit.owner : unit;
    k.on(
      "actionEnd",
      "a6",
      {
        subject: "otherAlly",
        abilityKinds: ["followUp"],
        attack: true,
        when: (event) => holder(event.unit).has(wager),
        limitPerOwnTurn: k.traceParam(3, 3),
      },
      (ctx) => gainBet(ctx, 1)
    );
  }

  if (k.e(6)) {
    k.on("actionStart", "e6", {}, (ctx) => {
      const shielded = ctx.allies.filter(
        (ally) => ally.id !== ctx.self.id && ally.has(wager)
      ).length;
      if (ctx.self.has(e6Boost)) {
        ctx.setStatusStacks(ctx.self, e6Boost, shielded);
      } else if (shielded > 0) {
        ctx.applyStatus(ctx.self, e6Boost, { setStacks: shielded });
      }
    });
  }

  // Basic ATK; Skill only when an ally has lost Fortified Wager (A4, A6, and
  // E1 refresh it for the whole team).
  k.policy({
    turn: (view) =>
      view.skillPoints >= 1 &&
      view.allies.some((ally) => ally.kind === "character" && !ally.has(wager))
        ? "skill"
        : "basic",
  });
});
