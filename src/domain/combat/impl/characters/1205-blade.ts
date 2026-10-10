import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef, ModifierDef } from "../../kit/model";

/** Blade — Destruction, Wind. */
export default defineCharacter("1205", (k) => {
  // HP is not simulated. Blade is played with a sustain, so the defaults
  // assume healing keeps him above 50% HP when he casts his Ultimate and that
  // the HP-loss tally (Skill, Forest of Swords, enemy hits, the Ultimate's own
  // HP reset) has reached its cap by then. With the tally toggle off, only
  // his own HP consumption since the last Ultimate counts.
  const ultAboveHalf = k.toggle(
    "ult-above-half-hp",
    "ultimate",
    "selfHpAbove",
    true,
    0.5
  );
  const tallyCapped = k.toggle(
    "hp-loss-tally-capped",
    "ultimate",
    "active",
    true
  );

  const tallyCap = k.param("03", 7);
  const maxCharge = k.e(6) ? 4 : 5; // E6: "reduced to 4" (no placeholder)
  const skillCost = k.param("02", 1);
  const forestCost = k.param("08", 1);

  const hellscapeModifiers: ModifierDef[] = [
    { stat: "dmgBoost", value: k.param("02", 4) },
  ];
  if (k.e(2)) {
    hellscapeModifiers.push({ stat: "critRate", value: k.rankParam(2, 1) });
  }
  const hellscape = k.status({
    id: "hellscape",
    origin: "skill",
    duration: { turns: k.param("02", 2) },
    modifiers: hellscapeModifiers,
  });

  const e4 = k.e(4)
    ? k.status({
        id: "e4-max-hp",
        origin: "e4",
        maxStacks: k.rankParam(4, 2),
        modifiers: [{ stat: "hpPct", value: k.rankParam(4, 1) }],
      })
    : null;

  if (k.a(3)) {
    // The Talent's Follow-Up ATK is Blade's only Follow-Up ATK.
    k.stat("a6", {
      stat: "dmgBoost",
      value: k.traceParam(3, 1),
      filter: { tags: ["followUp"] },
    });
  }

  const gainCharge = (ctx: BattleApi) => {
    ctx.addCounter(ctx.self, "charge", 1);
    const charge = ctx.self.counter("charge");
    if (charge < maxCharge - 1e-9) return;
    // Enemy hits add aggro-weighted Charge; the threshold crossing itself is
    // certain, so the Follow-Up ATK is queued at full weight.
    ctx.setCounter(ctx.self, "charge", charge - maxCharge);
    ctx.queueAction(ctx.self, "followUp", { weight: 1 / ctx.weight });
  };

  /** Own HP consumption: Charge, the tally, and the first drop to 50% (E4). */
  const consumeHp = (ctx: BattleApi, fraction: number) => {
    gainCharge(ctx);
    ctx.addCounter(ctx.self, "hp-tally", fraction, tallyCap);
    ctx.addCounter(ctx.self, "hp-consumed", fraction);
    // Approximation: from full HP, his own consumption first crosses 50%.
    if (
      e4 &&
      ctx.self.counter("e4-first-drop") === 0 &&
      ctx.self.counter("hp-consumed") >= 0.5 - 1e-9
    ) {
      ctx.setCounter(ctx.self, "e4-first-drop", 1);
      ctx.applyStatus(ctx.self, e4);
    }
  };

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
    target: "self",
    energy: 0,
    usable: (view) => !view.self.has(hellscape),
    after: (ctx) => {
      consumeHp(ctx, skillCost);
      // The Skill does not end the turn, so the turn it is used in counts
      // toward Hellscape's duration (Skill + 3 Forest of Swords). The engine
      // skips the applying turn's countdown, hence one turn fewer here.
      ctx.applyStatus(ctx.self, hellscape, {
        turns: k.param("02", 2) - 1,
      });
      ctx.queueAction(ctx.self, "enhancedBasic");
    },
  });

  // ATK and Max HP parts of one instance are separate HitDefs (one stat per
  // HitDef); only the HP part carries Toughness.
  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    energy: 30,
    skillPoints: 0,
    before: (ctx) => consumeHp(ctx, forestCost),
    hits: [
      {
        shape: "blast",
        stat: "hp",
        main: k.param("08", 4),
        adjacent: k.param("08", 5),
        toughness: { main: 20, adjacent: 10 },
      },
      {
        shape: "blast",
        main: k.param("08", 2),
        adjacent: k.param("08", 3),
      },
    ],
  });

  const tallyMain = k.param("03", 5) + (k.e(1) ? k.rankParam(1, 1) : 0); // E1: main target only
  const ultHp: HitDef = {
    shape: "blast",
    stat: "hp",
    main: 0,
    adjacent: 0,
    toughness: { main: 20, adjacent: 20 },
  };
  // The tally is in units of Max HP, so it adds to the HP multiplier.
  const setTally = (tally: number) => {
    ultHp.main = k.param("03", 2) + tallyMain * tally;
    ultHp.adjacent = k.param("03", 4) + k.param("03", 6) * tally;
  };
  setTally(tallyCap);

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (ultAboveHalf) {
        // Setting HP from above 50% down to 50% consumes HP.
        gainCharge(ctx);
        if (e4) ctx.applyStatus(ctx.self, e4);
      }
      if (!tallyCapped) setTally(ctx.self.counter("hp-tally"));
    },
    hits: [
      ultHp,
      { shape: "blast", main: k.param("03", 1), adjacent: k.param("03", 3) },
    ],
    after: (ctx) => ctx.setCounter(ctx.self, "hp-tally", 0),
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 10,
    hits: [
      {
        shape: "aoe",
        stat: "hp",
        each: k.param("04", 4) + (k.e(6) ? k.rankParam(6, 1) : 0),
        toughness: { each: 10 },
      },
      { shape: "aoe", each: k.param("04", 2) },
    ],
  });

  // "A max of 1 Charge stack can be gained every time he is attacked."
  k.on("hitByEnemy", "talent", {}, (ctx) => gainCharge(ctx));

  // Hellscape every turn: Skill (which continues into Forest of Swords) when
  // it is down, otherwise Forest of Swords; Basic ATK only without SP.
  k.policy({
    turn: (view) =>
      view.self.has(hellscape)
        ? "enhancedBasic"
        : view.skillPoints >= 1
          ? "skill"
          : "basic",
  });
});
