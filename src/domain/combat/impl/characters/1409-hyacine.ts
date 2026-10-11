import type {
  BattleApi,
  BattleEvent,
  PolicyView,
  UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Hyacine — Remembrance, Wind. */
export default defineCharacter("1409", (k) => {
  const ICA = "11409";
  // Expected Talent triggers of Little Ica waiting for the next turn start
  // or action end.
  const PENDING = "ica-pending";

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

  const findIca = (ctx: BattleApi, hyacine: UnitView) =>
    ctx.findSummon(hyacine, ICA);
  const icaPresent = (view: PolicyView) =>
    view.allies.some(
      (unit) => unit.owner === view.self && unit.definitionId === ICA
    );
  const isIca = (unit: UnitView, hyacine: UnitView) =>
    unit.owner === hyacine && unit.definitionId === ICA;
  // Ally targets: Characters and memosprites, not countdowns.
  const allyTargets = (ctx: BattleApi) =>
    ctx.allies.filter((unit) => unit.kind !== "summon");

  /**
   * Max HP with the timed bonuses the steady panel leaves out: After Rain
   * and, for Hyacine, A6.
   */
  const maxHp = (unit: UnitView, hyacineSpeed?: number) => {
    let pct = 0;
    let flat = 0;
    if (unit.has(afterRainHp)) {
      pct += afterRainHpPct;
      flat += k.param("03", 4);
    }
    if (k.a(3) && hyacineSpeed !== undefined && hyacineSpeed > speedThreshold) {
      pct += k.traceParam(3, 2);
    }
    return unit.panelStat("hp") + unit.panelStat("hpBase") * pct + flat;
  };

  /**
   * Hyacine or Little Ica heals `target` for pct × Hyacine's Max HP + flat.
   * Little Ica's Max HP is a share of Hyacine's; other memosprites read
   * their owner's (engine-memosprite-max-hp). The tally adds the requested
   * amount (overhealing included), in units of Hyacine's panel Max HP so
   * Rainclouds scales off it. Healing-received bonuses are not modeled.
   */
  const heal = (
    ctx: BattleApi,
    hyacine: UnitView,
    target: UnitView,
    pct: number,
    flat: number
  ) => {
    const panelHp = hyacine.panelStat("hp");
    if (panelHp <= 0) return;
    const hyacineHp = maxHp(hyacine, hyacine.speed);
    let boost = 1 + hyacine.panelStat("outgoingHealing");
    const excess = Math.max(0, hyacine.speed - speedThreshold);
    if (k.a(3) && excess > 0) {
      boost +=
        Math.floor(Math.min(excess, excessCap) / k.traceParam(3, 3)) *
        k.traceParam(3, 4);
    }
    if (k.a(1) && target.hpRatio <= k.traceParam(1, 2) + 1e-9) {
      boost += k.traceParam(1, 3);
    }
    const amount = (pct * hyacineHp + flat) * boost;
    const targetHp = isIca(target, hyacine)
      ? k.param("04", 1) * hyacineHp
      : target === hyacine
        ? hyacineHp
        : maxHp(target);
    if (targetHp > 0) ctx.heal(target, amount / targetHp);
    ctx.addCounter(hyacine, "tally", amount / panelHp);
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
    for (const ally of allyTargets(ctx)) {
      if (isIca(ally, ctx.self)) heal(ctx, ctx.self, ally, icaPct, icaFlat);
      else heal(ctx, ctx.self, ally, pct, flat);
    }
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
  // HP never drops below 1% in the engine, so Little Ica never runs out of
  // HP and "Fall, Then Take Wing" never triggers.
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

  // An ally target (except Little Ica) loses HP to a cost or an enemy.
  const hpReduced = (event: BattleEvent, self: UnitView) =>
    event.hpCause !== "heal" &&
    (event.delta ?? 0) < 0 &&
    event.unit.kind !== "summon" &&
    !isIca(event.unit, self);

  // Little Ica heals each ally target whose HP was reduced (here at once,
  // so the heal carries the loss's probability); its HP cost, the After
  // Rain heal, and the Talent stack follow once at the next turn start or
  // action end.
  k.on(
    "hpChanged",
    "memospriteTalent",
    { subject: "ally", when: hpReduced },
    (ctx, event) => {
      if (!findIca(ctx, ctx.self)) return;
      heal(
        ctx,
        ctx.self,
        event.unit,
        k.param("1140903", 2),
        k.param("1140903", 3)
      );
      ctx.addCounter(ctx.self, PENDING, 1, 1);
    }
  );
  const icaTalent = (ctx: BattleApi) => {
    const pending = ctx.self.counter(PENDING);
    if (pending <= 1e-9) return;
    ctx.setCounter(ctx.self, PENDING, 0);
    const ica = findIca(ctx, ctx.self);
    if (!ica) return;
    ctx.consumeHp(ica, k.param("1140903", 1) * pending);
    if (ctx.self.has(afterRain)) {
      for (const ally of allyTargets(ctx)) {
        heal(
          ctx,
          ctx.self,
          ally,
          k.param("1140903", 4) * pending,
          k.param("1140903", 5) * pending
        );
      }
    }
    providesHealing(ctx, ctx.self, pending);
  };
  k.on("turnStart", "memospriteTalent", { subject: "any" }, icaTalent);
  k.on("actionEnd", "memospriteTalent", { subject: "any" }, icaTalent);

  if (k.e(1)) {
    // An ally target heals itself after attacking during After Rain.
    k.on(
      "actionEnd",
      "e1",
      {
        subject: "ally",
        attack: true,
        when: (event, self) =>
          self.has(afterRain) && event.unit.kind !== "summon",
      },
      (ctx, event) => {
        heal(ctx, ctx.self, event.unit, k.rankParam(1, 2), 0);
        providesHealing(ctx, ctx.self, ctx.weight);
      }
    );
  }

  if (k.e(2)) {
    k.on(
      "hpChanged",
      "e2",
      {
        subject: "ally",
        when: (event) =>
          event.hpCause !== "heal" &&
          (event.delta ?? 0) < 0 &&
          event.unit.kind !== "summon",
      },
      (ctx, event) =>
        ctx.applyStatus(event.unit, e2Speed, { stacks: ctx.weight })
    );
  }

  if (k.e(6)) {
    // While Little Ica is on the field, including later memosprites.
    k.on("summoned", "e6", { subject: "ally" }, (ctx, event) => {
      if (isIca(event.unit, ctx.self)) {
        for (const ally of allyTargets(ctx)) ctx.applyStatus(ally, e6ResPen);
      } else if (event.unit.kind !== "summon" && findIca(ctx, ctx.self)) {
        ctx.applyStatus(event.unit, e6ResPen);
      }
    });
    k.on("departed", "e6", { subject: "memosprite" }, (ctx, event) => {
      if (!isIca(event.unit, ctx.self)) return;
      for (const ally of ctx.allies) ctx.removeStatus(ally, e6ResPen);
    });
  }

  // A healer: Skill to summon Little Ica, Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      !icaPresent(view) && view.skillPoints >= 1 ? "skill" : "basic",
  });
});
