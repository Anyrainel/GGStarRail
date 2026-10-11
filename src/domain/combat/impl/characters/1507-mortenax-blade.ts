import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef, StatusDef } from "../../kit/model";

const CHARGE = "mortenax:charge";
const OVERFLOW = "mortenax:overflow";
const E6_USED = "mortenax:e6-used";
const HIT_THIS_ATTACK = "mortenax:hit";
const HP_FLOOR = 0.01;

/** Mortenax Blade — Nihility, Fire. */
export default defineCharacter("1507", (k) => {
  const balefireBind = k.status({
    id: "balefire-bind",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 8) },
    modifiers: [
      { stat: "defReduction", value: k.param("03", 7) },
      { stat: "vulnerability", value: k.param("03", 4) },
    ],
  });
  const infiniteFury = k.status({
    id: "infinite-fury",
    origin: "ultimate",
    modifiers: [
      { stat: "critRate", value: k.param("03", 2) },
      { stat: "critDmg", value: k.param("03", 3) },
    ],
  });

  // Zone effects, applied when the Zone is deployed and removed with it.
  const otherNihility = k.countPath("Warlock") > 1;
  const zoneAllyStatuses: StatusDef[] = [];
  let zoneSelfStatus: StatusDef | null = null;
  if (k.a(3)) {
    zoneAllyStatuses.push(
      k.status({
        id: "heart-refined",
        origin: "a6",
        modifiers: [
          { stat: "dmgBoost", value: k.traceParam(3, 1) },
          ...(otherNihility
            ? [
                {
                  stat: "dmgBoost" as const,
                  value: k.traceParam(3, 2),
                  filter: { tags: ["ultimate" as const] },
                },
              ]
            : []),
        ],
      })
    );
    if (!otherNihility) {
      zoneSelfStatus = k.status({
        id: "heart-refined-self",
        origin: "a6",
        modifiers: [{ stat: "dmgBoost", value: k.traceParam(3, 3) }],
      });
    }
    if (k.e(4)) {
      zoneAllyStatuses.push(
        k.status({
          id: "odium-smitten",
          origin: "e4",
          modifiers: [{ stat: "dmgBoost", value: k.rankParam(4, 1) }],
        })
      );
    }
  }
  const zoneEnemyStatus = k.e(1)
    ? k.status({
        id: "ere-my-death",
        origin: "e1",
        modifiers: [{ stat: "resReduction", value: k.rankParam(1, 1) }],
      })
    : null;

  // E2: allies' Ultimate DMG counts as Follow-Up ATK DMG. Other kits' tags
  // cannot be changed, so the bonus covers Ultimate DMG directly; other
  // Follow-Up-only effects do not reach those Ultimates.
  if (k.e(2)) {
    k.teamStat("e2", {
      stat: "dmgBoost",
      value: k.rankParam(2, 1),
      filter: { tags: ["followUp", "ultimate"] },
    });
  }

  // A2: Energy beyond the cap, from any source, is banked up to #2.
  if (k.a(1)) {
    k.on(
      "energyGained",
      "a2",
      { subject: "self", when: (event) => (event.overflow ?? 0) > 0 },
      (ctx, event) =>
        ctx.addCounter(
          ctx.self,
          OVERFLOW,
          event.overflow ?? 0,
          k.traceParam(1, 2)
        )
    );
  }
  const restoreEnergyFloor = (ctx: BattleApi, unit: UnitView) => {
    if (!k.a(1)) return;
    const floor = unit.maxEnergy * k.traceParam(1, 1);
    if (unit.energy < floor) ctx.setEnergy(unit, floor);
  };

  // HP never drops below 1% (the engine's stand-in for 1 HP): "current HP
  // is 1 or lower" means HP at that floor. Receiving a killing blow (which
  // would end the Zone and restore HP) is not simulated.
  const aboveOneHp = (unit: UnitView) => unit.hpRatio > HP_FLOOR + 1e-9;

  const chargeCap = k.e(2) ? k.rankParam(2, 2) : k.param("04", 1);
  // Charge is an expected value (being attacked is weighted by aggro); the
  // Energy and extra Skill fire in full once it reaches the cap, and wait
  // there while HP is 1.
  const addCharge = (ctx: BattleApi, amount = 1) => {
    if (!ctx.self.has(infiniteFury)) return;
    ctx.addCounter(ctx.self, CHARGE, amount, chargeCap);
    if (ctx.self.counter(CHARGE) + 1e-9 < chargeCap) return;
    if (!aboveOneHp(ctx.self)) return;
    ctx.setCounter(ctx.self, CHARGE, 0);
    const full = 1 / ctx.weight;
    ctx.gainEnergy(ctx.self, k.param("04", 2) * full);
    ctx.queueAction(ctx.self, "followUp", { weight: full });
  };
  if (k.e(6)) {
    // Taking DMG or consuming HP grants Charge, once until any turn ends.
    // Weighted triggers (enemy hits by aggro) use up a share of that once.
    k.on(
      "hpChanged",
      "e6",
      {
        subject: "self",
        when: (event, self) =>
          (event.hpCause === "consume" || event.hpCause === "enemy") &&
          self.has(infiniteFury) &&
          self.counter(E6_USED) < 1 - 1e-9,
      },
      (ctx) => {
        const share = Math.min(1, (1 - ctx.self.counter(E6_USED)) / ctx.weight);
        ctx.addCounter(ctx.self, E6_USED, share);
        addCharge(ctx, share);
      }
    );
    k.on("turnEnd", "e6", { subject: "any" }, (ctx) =>
      ctx.setCounter(ctx.self, E6_USED, 0)
    );
  }

  // Closure references: the Ultimate's hits depend on Infinite Fury, and
  // E1 delays the countdown, which kit handlers cannot look up otherwise.
  let blade: UnitView | null = null;
  let countdownUnit: UnitView | null = null;

  const endZone = (ctx: BattleApi, owner: UnitView) => {
    ctx.removeStatus(owner, infiniteFury);
    if (zoneSelfStatus) ctx.removeStatus(owner, zoneSelfStatus);
    for (const ally of ctx.allies) {
      for (const status of zoneAllyStatuses) ctx.removeStatus(ally, status);
    }
    if (zoneEnemyStatus) {
      for (const enemy of ctx.enemies) ctx.removeStatus(enemy, zoneEnemyStatus);
    }
    restoreEnergyFloor(ctx, owner);
  };

  const countdown = k.summon({
    id: "infinite-fury-countdown",
    speed: k.param("03", 5),
    countdown: true,
    policy: () => "end",
    abilities: [
      {
        id: "end",
        kind: "other",
        target: "none",
        after: (ctx) => {
          const owner = ctx.self.owner;
          if (owner) endZone(ctx, owner);
          countdownUnit = null;
          ctx.dismiss(ctx.self);
        },
      },
    ],
  });

  k.on("battleStart", "a2", { subject: "any" }, (ctx) => {
    blade = ctx.self;
    restoreEnergyFloor(ctx, ctx.self);
  });

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
    id: "enhancedBasic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        main: k.param("08", 1),
        stat: "hp",
        toughness: { main: 10 },
      },
    ],
  });

  // Facts list 10 Toughness for every enemy and 5 per Bounce instance.
  const skillHits: HitDef[] = [
    {
      shape: "aoe",
      each: k.param("02", 1),
      stat: "hp",
      toughness: { each: 10 },
    },
    {
      shape: "bounce",
      bounces: k.param("02", 2),
      each: k.param("02", 3),
      stat: "hp",
      toughness: { each: 5 },
    },
  ];

  // "Consumes HP equal to #4 of Max HP" (down to 1 HP); unusable outside
  // Infinite Fury or at 1 HP.
  const payHp = (ctx: BattleApi) => ctx.consumeHp(ctx.self, k.param("02", 4));

  k.ability({
    id: "skill",
    kind: "skill",
    skillPoints: 0,
    usable: (view) => view.self.has(infiniteFury) && aboveOneHp(view.self),
    before: payHp,
    hits: skillHits,
  });

  // The Talent's extra Skill, "considered as Follow-Up ATK".
  k.ability({
    id: "followUp",
    kind: "followUp",
    tags: ["skill", "followUp"],
    skillPoints: 0,
    energy: 30,
    before: payHp,
    hits: skillHits,
    after: (ctx) => {
      if (k.e(1) && countdownUnit) {
        ctx.delayAction(countdownUnit, k.rankParam(1, 2));
      }
    },
  });

  const tenaxHits: readonly HitDef[] = [
    {
      shape: "aoe",
      each: k.param("14", 1) * (k.e(6) ? k.rankParam(6, 1) : 1),
      stat: "hp",
      toughness: { each: 20 },
    },
  ];

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    // Fornax Ex Corpore deals no DMG; in Infinite Fury the Ultimate becomes
    // Tenax Per Ignem. The Engine only casts "ultimate", so its hits follow
    // the state when the action starts.
    get hits() {
      return blade?.has(infiniteFury) ? tenaxHits : undefined;
    },
    after: (ctx) => {
      if (!ctx.self.has(infiniteFury)) {
        // Fornax Ex Corpore: Balefire Bind, then the HP cost deploys the Zone.
        for (const enemy of ctx.enemies) ctx.applyStatus(enemy, balefireBind);
        ctx.consumeHp(ctx.self, k.param("03", 1));
        ctx.applyStatus(ctx.self, infiniteFury);
        if (zoneSelfStatus) ctx.applyStatus(ctx.self, zoneSelfStatus);
        for (const ally of ctx.allies) {
          for (const status of zoneAllyStatuses) ctx.applyStatus(ally, status);
        }
        if (zoneEnemyStatus) {
          for (const enemy of ctx.enemies) {
            ctx.applyStatus(enemy, zoneEnemyStatus);
          }
        }
        countdownUnit = ctx.summon(ctx.self, countdown.id);
      }
      if (k.a(1)) {
        const banked = ctx.self.counter(OVERFLOW);
        ctx.setCounter(ctx.self, OVERFLOW, 0);
        ctx.gainEnergy(ctx.self, banked, { fixed: true });
      }
    },
  });

  // Talent: every ally attack in the Zone binds the attacked enemies and
  // grants 1 Charge.
  k.on("actionStart", "talent", { subject: "ally" }, (ctx) => {
    for (const enemy of ctx.enemies) ctx.setCounter(enemy, HIT_THIS_ATTACK, 0);
  });
  k.on("hit", "talent", { subject: "ally" }, (ctx, event) => {
    if (isEnemy(event.target) && !event.tags?.includes("dot")) {
      ctx.setCounter(event.target, HIT_THIS_ATTACK, 1);
    }
  });
  k.on("actionEnd", "talent", { subject: "ally", attack: true }, (ctx) => {
    if (!ctx.self.has(infiniteFury)) return;
    for (const enemy of ctx.enemies) {
      if (enemy.counter(HIT_THIS_ATTACK) > 0) {
        ctx.applyStatus(enemy, balefireBind);
      }
    }
    addCharge(ctx);
  });

  // A4 (the higher aggro is not modeled): being attacked binds the
  // attacker and grants Charge.
  if (k.a(2)) {
    k.on("hitByEnemy", "a4", { subject: "self" }, (ctx, event) => {
      if (!ctx.self.has(infiniteFury)) return;
      if (isEnemy(event.target)) ctx.applyStatus(event.target, balefireBind);
      addCharge(ctx);
    });
  }

  k.policy({
    // Skill (no SP cost) throughout Infinite Fury, Enhanced Basic ATK once
    // HP is down to 1; Basic ATK otherwise.
    turn: (view) =>
      view.self.has(infiniteFury)
        ? aboveOneHp(view.self)
          ? "skill"
          : "enhancedBasic"
        : "basic",
  });
});
