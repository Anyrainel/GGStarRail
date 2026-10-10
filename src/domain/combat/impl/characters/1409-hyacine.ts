import type { BattleApi, PolicyView, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Hyacine — Remembrance, Wind. */
export default defineCharacter("1409", (k) => {
  const ICA = "11409";

  const afterRainTurns = k.param("03", 5);
  // "This duration decreases by 1 at the start of Hyacine's every turn."
  const afterRain = k.status({
    id: "after-rain",
    origin: "ultimate",
    duration: { turns: afterRainTurns, countdown: "turnStart" },
  });
  const afterRainHpPct = k.param("03", 3) + (k.e(1) ? k.rankParam(1, 1) : 0);
  const afterRainHp = k.status({
    id: "after-rain-max-hp",
    origin: "ultimate",
    duration: {
      turns: afterRainTurns,
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: [
      { stat: "hpPct", value: afterRainHpPct },
      { stat: "hpFlat", value: k.param("03", 4) },
    ],
  });
  const firstLight = k.status({
    id: "first-light-heals-the-world",
    origin: "talent",
    duration: { turns: k.param("04", 4) },
    maxStacks: k.param("04", 5),
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 3) }],
  });
  const e2Speed = k.status({
    id: "e2-spd",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "spdPct", value: k.rankParam(2, 1) }],
  });
  const e6ResPen = k.status({
    id: "e6-res-pen",
    origin: "e6",
    modifiers: [{ stat: "resPen", value: k.rankParam(6, 2) }],
  });

  // Hyacine's permanent stats reach Little Ica through the shared panel.
  if (k.a(1)) k.stat("a2", { stat: "critRate", value: k.traceParam(1, 1) });
  if (k.a(2)) k.stat("a4", { stat: "effectRes", value: k.traceParam(2, 1) });
  const speedThreshold = k.traceParam(3, 1);
  const excessCap = k.traceParam(3, 5);
  if (k.a(3)) {
    // "Exceeds 200": SPD is fractional, so > and >= only differ at 200.
    k.stat("a6", {
      stat: "hpPct",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: speedThreshold,
        ratio: k.traceParam(3, 2),
      },
    });
    if (k.e(4)) {
      const critDmg: ModifierDef = {
        stat: "critDmg",
        scaling: {
          source: "holder",
          stat: "spd",
          threshold: speedThreshold,
          step: k.rankParam(4, 1),
          ratio: k.rankParam(4, 2),
          cap: (excessCap / k.rankParam(4, 1)) * k.rankParam(4, 2),
        },
      };
      k.stat("e4", critDmg);
    }
  }
  const lowHpHealing =
    k.a(1) && k.toggle("a2-low-hp-healing", "a2", "active", false);

  const findIca = (ctx: BattleApi, hyacine: UnitView) =>
    ctx.findSummon(hyacine, ICA);
  const icaPresent = (view: PolicyView) =>
    view.allies.some(
      (unit) => unit.owner === view.self && unit.definitionId === ICA
    );

  /**
   * Adds healing to the tally, kept in units of Hyacine's panel Max HP so
   * Rainclouds scales off it (tracker hyacine-healing-tally). Overhealing
   * counts; healing-received bonuses are not modeled.
   */
  const addTally = (
    ctx: BattleApi,
    hyacine: UnitView,
    pct: number,
    flat: number,
    targets: number
  ) => {
    const panelHp = hyacine.panelStat("hp");
    if (panelHp <= 0 || targets <= 0) return;
    const excess = Math.max(0, hyacine.speed - speedThreshold);
    let bonusPct = 0;
    let bonusFlat = 0;
    if (hyacine.has(afterRain)) {
      bonusPct += afterRainHpPct;
      bonusFlat += k.param("03", 4);
    }
    let boost = 1 + hyacine.panelStat("outgoingHealing");
    if (k.a(3) && excess > 0) {
      bonusPct += k.traceParam(3, 2);
      boost +=
        Math.floor(Math.min(excess, excessCap) / k.traceParam(3, 3)) *
        k.traceParam(3, 4);
    }
    if (lowHpHealing) boost += k.traceParam(1, 3);
    const maxHp = panelHp + hyacine.panelStat("hpBase") * bonusPct + bonusFlat;
    ctx.addCounter(
      hyacine,
      "tally",
      (targets * (pct * maxHp + flat) * boost) / panelHp
    );
  };

  /** Talent: Hyacine or Little Ica provides healing. */
  const providesHealing = (ctx: BattleApi, hyacine: UnitView, stacks = 1) => {
    const ica = findIca(ctx, hyacine);
    if (ica) ctx.applyStatus(ica, firstLight, { stacks });
  };

  /** Skill and Ultimate healing: all allies except Little Ica, then Ica. */
  const healTeam = (
    ctx: BattleApi,
    pct: number,
    flat: number,
    icaPct: number,
    icaFlat: number
  ) => {
    const ica = findIca(ctx, ctx.self);
    const others = ctx.allies.filter((unit) => unit !== ica).length;
    addTally(ctx, ctx.self, pct, flat, others);
    if (ica) addTally(ctx, ctx.self, icaPct, icaFlat, 1);
    providesHealing(ctx, ctx.self);
  };

  const summonIca = (ctx: BattleApi) => {
    if (findIca(ctx, ctx.self)) return;
    const ica = ctx.summon(ctx.self, ICA);
    // "Maintains 0 SPD ... will not appear in the Action Order."
    ctx.setInActionOrder(ica, false);
    const first = ctx.self.counter("ica-summoned") === 0;
    ctx.setCounter(ctx.self, "ica-summoned", 1);
    ctx.gainEnergy(
      ctx.self,
      k.param("1140905", 1) + (first ? k.param("1140905", 2) : 0)
    );
    if (k.e(6)) for (const ally of ctx.allies) ctx.applyStatus(ally, e6ResPen);
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        stat: "hp",
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "allies",
    before: (ctx) => {
      summonIca(ctx);
      healTeam(
        ctx,
        k.param("02", 1),
        k.param("02", 2),
        k.param("02", 3),
        k.param("02", 4)
      );
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      summonIca(ctx);
      healTeam(
        ctx,
        k.param("03", 1),
        k.param("03", 2),
        k.param("03", 6),
        k.param("03", 7)
      );
      ctx.applyStatus(ctx.self, afterRain);
      for (const ally of ctx.allies) ctx.applyStatus(ally, afterRainHp);
    },
  });

  const clearedShare = k.e(6) ? k.rankParam(6, 1) : k.param("1140901", 2);
  // Little Ica never runs out of HP here (HP is not simulated), so "Fall,
  // Then Take Wing" never triggers.
  k.memosprite({
    servantId: ICA,
    speed: { ownerRatio: 0, flat: 0 },
    abilities: [
      {
        id: "raincloudsTimeToGo",
        kind: "memospriteSkill",
        energy: 5,
        hits: (ctx) => [
          {
            shape: "aoe",
            each:
              k.param("1140901", 1) * (ctx.self.owner?.counter("tally") ?? 0),
            stat: "hp",
            statOwner: "owner",
            toughness: { each: 10 },
          },
        ],
        after: (ctx) => {
          const hyacine = ctx.self.owner;
          if (!hyacine) return;
          ctx.setCounter(
            hyacine,
            "tally",
            hyacine.counter("tally") * (1 - clearedShare)
          );
        },
      },
    ],
    policy: () => "raincloudsTimeToGo",
  });

  // During After Rain, Little Ica takes an extra turn after each of
  // Hyacine's abilities.
  k.on(
    "actionEnd",
    "memospriteTalent",
    {
      subject: "self",
      abilityKinds: ["basic", "skill", "ultimate"],
      when: (_event, self) => self.has(afterRain),
    },
    (ctx) => {
      const ica = findIca(ctx, ctx.self);
      if (ica) ctx.grantExtraTurn(ica);
    }
  );

  // Allies hit by enemies are healed by Little Ica after that action.
  k.on(
    "hitByEnemy",
    "memospriteTalent",
    { subject: "ally", when: (event) => event.unit.definitionId !== ICA },
    (ctx, event) => {
      ctx.addCounter(ctx.self, "hurt", 1);
      if (k.e(2)) ctx.applyStatus(event.unit, e2Speed, { stacks: ctx.weight });
    }
  );
  k.on("turnEnd", "memospriteTalent", { subject: "any" }, (ctx) => {
    const hurt = ctx.self.counter("hurt");
    if (hurt <= 1e-9) return;
    ctx.setCounter(ctx.self, "hurt", 0);
    if (!findIca(ctx, ctx.self)) return;
    addTally(ctx, ctx.self, k.param("1140903", 2), k.param("1140903", 3), hurt);
    if (ctx.self.has(afterRain)) {
      addTally(
        ctx,
        ctx.self,
        k.param("1140903", 4),
        k.param("1140903", 5),
        ctx.allies.length
      );
    }
    providesHealing(ctx, ctx.self, Math.min(1, hurt));
  });

  if (k.e(1)) {
    // An ally target heals itself after attacking during After Rain.
    k.on(
      "actionEnd",
      "e1",
      {
        subject: "ally",
        attack: true,
        when: (_event, self) => self.has(afterRain),
      },
      (ctx) => {
        addTally(ctx, ctx.self, k.rankParam(1, 2), 0, 1);
        providesHealing(ctx, ctx.self, ctx.weight);
      }
    );
  }

  if (k.e(6)) {
    // Memosprites summoned later also receive the RES PEN.
    k.on("turnStart", "e6", { subject: "any" }, (ctx) => {
      if (!findIca(ctx, ctx.self)) return;
      for (const ally of ctx.allies) {
        if (!ally.has(e6ResPen)) ctx.applyStatus(ally, e6ResPen);
      }
    });
  }

  // A healer: Skill to summon Little Ica, Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      !icaPresent(view) && view.skillPoints >= 1 ? "skill" : "basic",
  });
});
