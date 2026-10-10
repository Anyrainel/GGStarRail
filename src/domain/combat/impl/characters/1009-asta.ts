import {
  type BattleApi,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { StatusDef } from "../../kit/model";

/** Asta — Harmony, Fire. */
export default defineCharacter("1009", (k) => {
  const CHARGING = "charging";
  const TURNS = "turns";
  const E2_HOLD = "e2-hold";

  const maxCharging = k.param("04", 2);
  // "further deals DMG for 4 extra times" (E1: "1 extra time") has no
  // placeholder.
  const bounces = 4 + (k.e(1) ? 1 : 0);

  const chargingAtk = k.status({
    id: "charging",
    origin: "talent",
    maxStacks: maxCharging,
    modifiers: [{ stat: "atkPct", value: k.param("04", 1) }],
  });
  const constellation = k.status({
    id: "constellation",
    origin: "a6",
    maxStacks: maxCharging,
    modifiers: [{ stat: "defPct", value: k.traceParam(3, 1) }],
  });
  const e4Regen = k.status({
    id: "e4-energy-regen",
    origin: "e4",
    modifiers: [{ stat: "energyRegen", value: k.rankParam(4, 2) }],
  });

  const burn = k.status({
    id: "sparks-burn",
    origin: "a2",
    debuff: true,
    family: "burn",
    duration: { turns: k.traceParam(1, 2) },
    // "50% of DMG dealt by Asta's Basic ATK": read as 50% of the Basic
    // ATK's multiplier on ATK, as a DoT.
    dot: {
      hit: {
        shape: "single",
        main: k.traceParam(1, 3) * k.param("01", 1),
        kind: "dot",
      },
    },
  });

  const astralBlessing = k.status({
    id: "astral-blessing",
    origin: "ultimate",
    duration: { turns: k.param("03", 2) },
    modifiers: [{ stat: "spdFlat", value: k.param("03", 1) }],
  });

  if (k.a(2)) {
    k.teamStat("a4", {
      stat: "dmgBoost",
      value: k.traceParam(2, 1),
      filter: { combatTypes: ["Fire"] },
    });
  }

  /**
   * Expected Charging from one attack: 1 per different enemy hit, +1 when it
   * is weak to Fire. The Skill's random instances reach a non-designated
   * enemy with probability 1 − (1 − 1/N)^bounces.
   */
  const chargingGain = (
    hit: readonly EnemyView[],
    designated: UnitView | null | undefined,
    enemyCount: number,
    random: boolean
  ) =>
    hit.reduce((total, enemy) => {
      const chance =
        !random || enemy === designated
          ? 1
          : 1 - (1 - 1 / Math.max(1, enemyCount)) ** bounces;
      return total + chance * (enemy.weaknesses.has("Fire") ? 2 : 1);
    }, 0);

  const sync = (
    ctx: BattleApi,
    unit: UnitView,
    status: StatusDef,
    n: number
  ) => {
    if (unit.has(status)) ctx.setStatusStacks(unit, status, n);
    else if (n > 0) ctx.applyStatus(unit, status, { setStacks: n });
  };
  const syncCharging = (ctx: BattleApi) => {
    const stacks = ctx.self.counter(CHARGING);
    for (const ally of ctx.allies) sync(ctx, ally, chargingAtk, stacks);
    if (k.a(3)) sync(ctx, ctx.self, constellation, stacks);
    if (k.e(4)) {
      if (stacks >= k.rankParam(4, 1)) {
        if (!ctx.self.has(e4Regen)) ctx.applyStatus(ctx.self, e4Regen);
      } else {
        ctx.removeStatus(ctx.self, e4Regen);
      }
    }
  };

  k.on(
    "actionEnd",
    "talent",
    { subject: "self", attack: true },
    (ctx, event) => {
      const gain = chargingGain(
        event.targetsHit ?? [],
        event.target,
        ctx.enemies.length,
        event.abilityId === "skill"
      );
      ctx.addCounter(ctx.self, CHARGING, gain, maxCharging);
      syncCharging(ctx);
    }
  );

  const loss = k.param("04", 3) - (k.e(6) ? k.rankParam(6, 1) : 0);
  k.on("turnStart", "talent", { subject: "self" }, (ctx) => {
    ctx.addCounter(ctx.self, TURNS, 1);
    if (ctx.self.counter(TURNS) < 2) return;
    if (k.e(2) && ctx.self.counter(E2_HOLD) > 0) {
      ctx.setCounter(ctx.self, E2_HOLD, 0);
      return;
    }
    ctx.setCounter(
      ctx.self,
      CHARGING,
      Math.max(0, ctx.self.counter(CHARGING) - loss)
    );
    syncCharging(ctx);
  });

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => {
      if (k.a(1) && isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, burn, { baseChance: k.traceParam(1, 1) });
      }
    },
  });

  // Bounce facts list Energy (6) and Toughness (10) per instance.
  k.ability({
    id: "skill",
    kind: "skill",
    energy: 6 * (1 + bounces),
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 10 } },
      {
        shape: "bounce",
        each: k.param("02", 1),
        bounces,
        toughness: { each: 10 },
      },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, astralBlessing);
    },
    after: (ctx) => {
      if (k.e(2)) ctx.setCounter(ctx.self, E2_HOLD, 1);
    },
  });

  // Skill only when its Bounce builds more Charging than Basic ATK would
  // (several enemies); otherwise Basic ATK for Burn and Skill Points.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      const stacks = view.self.counter(CHARGING);
      const target = view.mainTarget;
      const count = view.enemies.length;
      const basic = target ? chargingGain([target], target, count, false) : 0;
      const skill = chargingGain(view.enemies, target, count, true);
      return Math.min(maxCharging, stacks + skill) >
        Math.min(maxCharging, stacks + basic) + 1e-6
        ? "skill"
        : "basic";
    },
  });
});
