import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const CHARGE = "charge";
const TALLY = "hp-tally";

/** Blade — Destruction, Wind. */
export default defineCharacter("1205", (k) => {
  const tallyCap = k.param("03", 7);
  const maxCharge = k.e(6) ? 4 : 5; // E6: "reduced to 4" (no placeholder)

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
    ctx.addCounter(ctx.self, CHARGE, 1);
    const charge = ctx.self.counter(CHARGE);
    if (charge < maxCharge - 1e-9) return;
    // Enemy hits add aggro-weighted Charge; the threshold crossing itself is
    // certain, so the Follow-Up ATK is queued at full weight.
    ctx.setCounter(ctx.self, CHARGE, charge - maxCharge);
    ctx.queueAction(ctx.self, "followUp", { weight: 1 / ctx.weight });
  };

  /** Heals Blade by `share` of Max HP plus `flat` HP (his own healing). */
  const healSelf = (ctx: BattleApi, share: number, flat = 0) => {
    const maxHp = ctx.self.currentStat("hp");
    if (maxHp <= 0) return;
    const boost = 1 + ctx.self.currentStat("outgoingHealing");
    ctx.heal(ctx.self, (share + flat / maxHp) * boost);
  };

  // HP consumed by Blade or by allies (Jingliu) gives Charge; enemy DMG gives
  // it through hitByEnemy (at most 1 per attack).
  k.on(
    "hpChanged",
    "talent",
    { when: (event) => event.hpCause === "consume" },
    (ctx) => gainCharge(ctx)
  );
  k.on("hitByEnemy", "talent", {}, (ctx) => gainCharge(ctx));

  // The tally sums every HP loss, the Ultimate's own HP reset included.
  k.on(
    "hpChanged",
    "ultimate",
    { when: (event) => (event.delta ?? 0) < 0 },
    (ctx, event) =>
      ctx.addCounter(ctx.self, TALLY, -(event.delta ?? 0), tallyCap)
  );

  if (e4) {
    // "Drops from above 50% to 50% or lower"; a partial (weighted) crossing
    // gives a partial stack.
    k.on(
      "hpChanged",
      "e4",
      {
        when: (event, self) => {
          const after = self.hpRatio;
          const before = after - (event.delta ?? 0) * event.weight;
          return before > 0.5 + 1e-9 && after <= 0.5 + 1e-9;
        },
      },
      (ctx, event) => ctx.applyStatus(ctx.self, e4, { stacks: event.weight })
    );
  }

  if (k.a(1)) {
    // Healing received at 50% HP or lower: the restored share (not capped at
    // Max HP when it is reported) is raised by #1.
    let boosting = false;
    k.on(
      "hpChanged",
      "a2",
      {
        when: (event, self) =>
          !boosting &&
          event.hpCause === "heal" &&
          (event.delta ?? 0) > 0 &&
          self.hpRatio - (event.delta ?? 0) * event.weight <= 0.5 + 1e-9,
      },
      (ctx, event) => {
        boosting = true;
        ctx.heal(ctx.self, (event.delta ?? 0) * k.traceParam(1, 1));
        boosting = false;
      }
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // The Skill does not end the turn, so the turn it is used in counts toward
  // Hellscape's duration (Skill + 3 Forest of Swords). The engine skips the
  // applying turn's countdown, hence one turn fewer here.
  k.ability({
    id: "skill",
    kind: "skill",
    target: "self",
    energy: 0,
    endsTurn: false,
    usable: (view) => !view.self.has(hellscape),
    after: (ctx) => {
      ctx.consumeHp(ctx.self, k.param("02", 1));
      ctx.applyStatus(ctx.self, hellscape, {
        turns: k.param("02", 2) - 1,
      });
    },
  });

  // ATK and Max HP parts of one instance are separate HitDefs; the ATK part
  // is silent so per-hit effects fire once, and the HP part carries Toughness.
  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    energy: 30,
    skillPoints: 0,
    before: (ctx) => {
      ctx.consumeHp(ctx.self, k.param("08", 1));
    },
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
        silent: true,
      },
    ],
    after: (ctx) => {
      if (k.a(2) && ctx.targetsHit().some((enemy) => enemy.broken)) {
        healSelf(ctx, k.traceParam(2, 1), k.traceParam(2, 2));
      }
    },
  });

  const tallyMain = k.param("03", 5) + (k.e(1) ? k.rankParam(1, 1) : 0); // E1: main target only

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      ctx.setHp(ctx.self, 0.5);
    },
    // The tally is in units of Max HP, so it adds to the HP multiplier.
    hits: (ctx) => {
      const tally = Math.min(ctx.self.counter(TALLY), tallyCap);
      return [
        {
          shape: "blast",
          stat: "hp",
          main: k.param("03", 2) + tallyMain * tally,
          adjacent: k.param("03", 4) + k.param("03", 6) * tally,
          toughness: { main: 20, adjacent: 20 },
        },
        {
          shape: "blast",
          main: k.param("03", 1),
          adjacent: k.param("03", 3),
          silent: true,
        },
      ];
    },
    after: (ctx) => ctx.setCounter(ctx.self, TALLY, 0),
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
      { shape: "aoe", each: k.param("04", 2), silent: true },
    ],
    after: (ctx) => healSelf(ctx, k.param("04", 3)),
  });

  // Hellscape every turn: Skill (the turn continues into Forest of Swords)
  // when it is down, otherwise Forest of Swords; Basic ATK only without SP.
  k.policy({
    turn: (view) =>
      view.self.has(hellscape)
        ? "enhancedBasic"
        : view.skillPoints >= 1
          ? "skill"
          : "basic",
  });
});
