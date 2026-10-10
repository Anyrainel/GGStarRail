import type {
  BattleApi,
  BattleEvent,
  PolicyView,
  UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef, StatusDef } from "../../kit/model";

/** Evernight — Remembrance, Ice. */
export default defineCharacter("1413", (k) => {
  const EVEY = "11413";
  // Kept on Evernight. Cyrene's "Ode to Time" adds to the same counter.
  const MEMORIA = "memoria";
  const CHARGE = "darkest-riddle-charge";
  // 1 once the Talent's immediate action was used; Dew re-arms it.
  const RUSH_SPENT = "evey-rush-spent";

  // Evey's Max HP is a fraction of Evernight's; memosprites read their
  // owner's panel, so Evey's HP-scaled multipliers carry the ratio.
  const eveyHp = k.param("04", 5);
  const threshold = k.param("04", 6);
  const memoriaBonus = k.e(2) ? k.rankParam(2, 1) : 0;

  const daySlipsModifiers: ModifierDef[] = [
    {
      stat: "critDmg",
      scaling: { source: "applier", stat: "critDmg", ratio: k.param("02", 1) },
    },
  ];
  if (k.a(3)) {
    const remembrance = Math.min(4, Math.max(1, k.countPath("Memory")));
    daySlipsModifiers.push({
      stat: "critDmg",
      value: k.traceParam(3, remembrance),
    });
  }
  // "This duration decreases by 1 at the start of Evernight's every turn."
  const daySlips = k.status({
    id: "day-gently-slips",
    origin: "skill",
    duration: {
      turns: k.param("02", 2),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: daySlipsModifiers,
  });
  const withMe = k.status({
    id: "with-me-this-night",
    origin: "talent",
    duration: { turns: k.param("04", 3) },
    modifiers: [{ stat: "critDmg", value: k.param("04", 2) }],
  });
  const a2CritDmg = k.status({
    id: "dark-the-night",
    origin: "a2",
    duration: { turns: k.traceParam(1, 4) },
    modifiers: [{ stat: "critDmg", value: k.traceParam(1, 3) }],
  });
  const solitude = k.status({
    id: "solitude-drifting",
    origin: "memospriteTalent",
    modifiers: [{ stat: "dmgBoost", value: k.param("1141303", 1) }],
  });
  const riddle = k.status({
    id: "darkest-riddle",
    origin: "ultimate",
    modifiers: [{ stat: "dmgBoost", value: k.param("03", 3) }],
  });
  const riddleVulnerability = k.status({
    id: "darkest-riddle-vulnerability",
    origin: "ultimate",
    debuff: true,
    modifiers: [{ stat: "vulnerability", value: k.param("03", 4) }],
  });
  // "Removed at the start of Evernight's next turn"; it cannot stack.
  const partingSpd = k.status({
    id: "parting-spd",
    origin: "memospriteTalent",
    duration: { turns: 1, countdown: "turnStart" },
    modifiers: [{ stat: "spdPct", value: k.param("1141306", 1) }],
  });
  const partingSpdMemoria = k.status({
    id: "parting-spd-memoria",
    origin: "memospriteTalent",
    duration: { turns: 1, countdown: "turnStart" },
    maxStacks: k.param("1141306", 3),
    modifiers: [{ stat: "spdPct", value: k.param("1141306", 2) }],
  });
  // E1: one status per enemy-count bracket (≥4 / 3 / 2 / 1 enemies).
  const e1Brackets: StatusDef[] = [1, 2, 3, 4].map((index) =>
    k.status({
      id: `e1-sleep-tight-${index}`,
      origin: "e1",
      modifiers: [{ stat: "dmgMultiplier", value: k.rankParam(1, index) - 1 }],
    })
  );
  const e4Memosprites = k.status({
    id: "e4-memosprites",
    origin: "e4",
    modifiers: [{ stat: "breakEfficiency", value: k.rankParam(4, 1) }],
  });
  const e4Evey = k.status({
    id: "e4-evey",
    origin: "e4",
    modifiers: [{ stat: "breakEfficiency", value: k.rankParam(4, 2) }],
  });

  if (k.a(1)) k.stat("a2", { stat: "critRate", value: k.traceParam(1, 1) });
  if (k.e(2)) k.stat("e2", { stat: "critDmg", value: k.rankParam(2, 3) });
  if (k.e(6)) k.teamStat("e6", { stat: "resPen", value: k.rankParam(6, 2) });

  const findEvey = (ctx: BattleApi, owner: UnitView) =>
    ctx.findSummon(owner, EVEY);

  const isEvey = (unit: UnitView, owner: UnitView) =>
    unit.owner === owner && unit.definitionId === EVEY;

  // E1/E4 reach every ally memosprite while Evernight is on the field,
  // including memosprites summoned later.
  if (k.e(1) || k.e(4)) {
    k.on(
      "summoned",
      k.e(1) ? "e1" : "e4",
      { subject: "ally", when: (event) => event.unit.kind === "memosprite" },
      (ctx, event) => {
        const memosprite = event.unit;
        if (k.e(1)) {
          const enemies = ctx.enemies.length;
          const e1 =
            e1Brackets[
              enemies >= 4 ? 0 : enemies === 3 ? 1 : enemies === 2 ? 2 : 3
            ];
          if (e1) ctx.applyStatus(memosprite, e1);
        }
        if (k.e(4)) {
          ctx.applyStatus(memosprite, e4Memosprites);
          if (isEvey(memosprite, ctx.self)) {
            ctx.applyStatus(memosprite, e4Evey);
          }
        }
      }
    );
  }

  const gainMemoria = (ctx: BattleApi, owner: UnitView, amount: number) => {
    ctx.addCounter(owner, MEMORIA, amount + memoriaBonus);
    if (owner.counter(MEMORIA) + 1e-9 < threshold) return;
    if (owner.counter(RUSH_SPENT) > 0) return;
    const evey = findEvey(ctx, owner);
    if (!evey) return;
    // Talent: at 16 Memoria, Evey immediately takes action.
    ctx.advanceAction(evey, 1);
    ctx.setCounter(owner, RUSH_SPENT, 1);
  };

  const summonEvey = (ctx: BattleApi, owner: UnitView): UnitView => {
    const present = findEvey(ctx, owner);
    if (present) return present;
    const evey = ctx.summon(owner, EVEY);
    ctx.applyStatus(owner, solitude);
    ctx.applyStatus(evey, solitude);
    if (owner.has(riddle)) ctx.applyStatus(evey, riddle);
    // "When summoned, this unit immediately takes action."
    ctx.advanceAction(evey, 1);
    return evey;
  };

  // Talent: each HP loss of Evernight or Evey, to a cost or once per
  // received attack (enemy attacks only target Characters here:
  // engine-memosprite-enemy-targets).
  const lostHp = (event: BattleEvent, self: UnitView) =>
    (event.hpCause === "consume" || event.hpCause === "enemy") &&
    (event.delta ?? 0) < 0 &&
    (event.unit === self || isEvey(event.unit, self));
  k.on(
    "hpChanged",
    "talent",
    { subject: "selfOrMemosprite", when: lostHp },
    (ctx) => {
      ctx.applyStatus(ctx.self, withMe, { stacks: ctx.weight });
      const evey = findEvey(ctx, ctx.self);
      if (evey) ctx.applyStatus(evey, withMe, { stacks: ctx.weight });
      gainMemoria(ctx, ctx.self, k.param("04", 1));
    }
  );

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    summonEvey(ctx, ctx.self);
    if (k.a(2)) {
      ctx.gainEnergy(ctx.self, k.traceParam(2, 2));
      gainMemoria(ctx, ctx.self, k.traceParam(2, 3));
    }
  });

  // A2: every ability consumes 5% of Evernight's current HP for CRIT DMG.
  if (k.a(1)) {
    k.on(
      "actionStart",
      "a2",
      { subject: "self", abilityKinds: ["basic", "skill", "ultimate"] },
      (ctx) => {
        ctx.consumeHp(ctx.self, ctx.self.hpRatio * k.traceParam(1, 2));
        ctx.applyStatus(ctx.self, a2CritDmg);
        const evey = findEvey(ctx, ctx.self);
        if (evey) ctx.applyStatus(evey, a2CritDmg);
      }
    );
  }

  if (k.a(2)) {
    k.on(
      "actionStart",
      "a4",
      {
        subject: "ally",
        when: (event, self) =>
          event.unit === self || event.unit.kind === "memosprite",
      },
      (ctx, event) => {
        if (
          event.unit === ctx.self &&
          !["basic", "skill", "ultimate"].includes(event.abilityKind ?? "")
        ) {
          return;
        }
        ctx.gainEnergy(ctx.self, k.traceParam(2, 4));
        gainMemoria(ctx, ctx.self, k.traceParam(2, 1));
      }
    );
  }

  // "At the start of Evernight's turn, if no Charge remains, exits."
  k.on(
    "turnStart",
    "ultimate",
    {
      subject: "self",
      when: (_event, self) => self.has(riddle) && self.counter(CHARGE) <= 1e-9,
    },
    (ctx) => {
      ctx.removeStatus(ctx.self, riddle);
      const evey = findEvey(ctx, ctx.self);
      if (evey) ctx.removeStatus(evey, riddle);
      for (const enemy of ctx.enemies) {
        ctx.removeStatus(enemy, riddleVulnerability);
      }
    }
  );

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

  // Facts: the Skill costs no Skill Point (it consumes HP).
  k.ability({
    id: "skill",
    kind: "skill",
    target: "none",
    skillPoints: 0,
    before: (ctx) => {
      ctx.consumeHp(ctx.self, ctx.self.hpRatio * k.param("02", 6));
      const present = findEvey(ctx, ctx.self);
      if (present) ctx.heal(present, k.param("02", 4));
      summonEvey(ctx, ctx.self);
      for (const ally of ctx.allies) {
        if (ally.kind === "memosprite") ctx.applyStatus(ally, daySlips);
      }
      gainMemoria(
        ctx,
        ctx.self,
        k.param("02", 3) + (ctx.self.has(riddle) ? k.param("02", 5) : 0)
      );
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "none",
    attack: true,
    before: (ctx) => {
      const evey = summonEvey(ctx, ctx.self);
      // Evey deals the Ultimate's DMG: Ultimate DMG dealt by a memosprite.
      ctx.deal(
        {
          shape: "aoe",
          each: k.param("03", 1) * eveyHp,
          stat: "hp",
          toughness: { each: 30 },
        },
        { attacker: evey, tags: ["ultimate", "memosprite"] }
      );
      ctx.applyStatus(ctx.self, riddle);
      ctx.applyStatus(evey, riddle);
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, riddleVulnerability);
      }
      ctx.addCounter(
        ctx.self,
        CHARGE,
        k.param("03", 2) + (k.e(2) ? k.rankParam(2, 2) : 0)
      );
    },
  });

  const memoriaOf = (unit: UnitView) => unit.owner?.counter(MEMORIA) ?? 0;

  const whirlBase = k.param("1141301", 1);
  const whirlStep = k.param("1141301", 3);
  const whirlPerStep = k.param("1141301", 2);
  const dewMain = k.param("1141307", 1);
  const dewOther = k.param("1141307", 2);
  const dewThreshold = k.param("1141307", 3);

  k.memosprite({
    servantId: EVEY,
    // "Evey has an initial SPD of 160."
    speed: { flat: k.param("04", 4) },
    policy: (view: PolicyView) =>
      memoriaOf(view.self) + 1e-9 >= dewThreshold ? "dew" : "whirl",
    abilities: [
      {
        id: "whirl",
        kind: "memospriteSkill",
        energy: 20,
        // The per-4-Memoria part is added to the same instance.
        hits: (ctx) => [
          {
            shape: "single",
            main:
              eveyHp *
              (whirlBase +
                Math.floor(memoriaOf(ctx.self) / whirlStep + 1e-9) *
                  whirlPerStep),
            stat: "hp",
            toughness: { main: 10 },
          },
        ],
        after: (ctx) => {
          const owner = ctx.self.owner;
          if (owner) gainMemoria(ctx, owner, k.param("1141301", 4));
        },
      },
      {
        id: "dew",
        kind: "memospriteSkill",
        energy: 10,
        hits: (ctx) => {
          const memoria = memoriaOf(ctx.self);
          return [
            {
              shape: "aoe",
              main: eveyHp * dewMain * memoria,
              each: eveyHp * dewOther * memoria,
              stat: "hp",
              toughness: { main: 30, each: 20 },
            },
          ];
        },
        after: (ctx) => {
          const owner = ctx.self.owner;
          if (!owner) return;
          const consumed = owner.counter(MEMORIA);
          ctx.setCounter(owner, MEMORIA, 0);
          ctx.setCounter(owner, RUSH_SPENT, 0);
          if (owner.has(riddle)) ctx.addCounter(owner, CHARGE, -1);
          if (k.a(1)) ctx.gainSkillPoints(1);
          // Evey disappears: Evernight's SPD Boost, then E6 Memoria.
          ctx.dismiss(ctx.self);
          ctx.removeStatus(owner, solitude);
          ctx.applyStatus(owner, partingSpd);
          ctx.applyStatus(owner, partingSpdMemoria, {
            setStacks: Math.floor(consumed + 1e-9),
          });
          if (k.e(6)) {
            gainMemoria(ctx, owner, k.rankParam(6, 1) * consumed);
          }
        },
      },
    ],
  });

  const evey = (view: PolicyView) =>
    view.allies.find(
      (ally) => ally.owner === view.self && ally.definitionId === EVEY
    ) ?? null;

  // Skill to (re)summon Evey, to keep the memosprite CRIT DMG buff up, and
  // every turn in Darkest Riddle for its extra Memoria; Basic ATK otherwise.
  k.policy({
    turn: (view) => {
      const current = evey(view);
      if (!current?.has(daySlips) || view.self.has(riddle)) {
        return "skill";
      }
      return "basic";
    },
  });
});
