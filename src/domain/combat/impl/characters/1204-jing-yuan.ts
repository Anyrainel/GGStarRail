import {
  type AbilityDef,
  type BattleApi,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter, preferSkill } from "../../kit/character";
import type { HitDef } from "../../kit/model";
import { actionValue } from "../../model/formulas";

const HITS = "lightning-lord-hits";
const STRIKES = "lightning-lord-strikes";

/** E[min(cap, X)] for X ~ Binomial(trials, chance). */
function expectedCapped(trials: number, chance: number, cap: number): number {
  let total = 0;
  let coefficient = 1;
  for (let count = 0; count <= trials; count += 1) {
    if (count > 0) coefficient = (coefficient * (trials - count + 1)) / count;
    total +=
      Math.min(cap, count) *
      coefficient *
      chance ** count *
      (1 - chance) ** (trials - count);
  }
  return total;
}

/** Jing Yuan — Erudition, Lightning. */
export default defineCharacter("1204", (k) => {
  const baseSpeed = k.param("04", 1);
  const strikeMultiplier = k.param("04", 2);
  const speedPerHit = k.param("04", 3);
  const baseHits = k.param("04", 4);
  const maxHits = k.param("04", 6);
  // "Adjacent enemies receive 25% of the DMG dealt to the primary target" is
  // taken as 25% of the multiplier, which is how E1 words the same quantity.
  const splashMultiplier =
    strikeMultiplier * (k.param("04", 5) + (k.e(1) ? k.rankParam(1, 1) : 0));

  const warMarshal = k.status({
    id: "war-marshal",
    origin: "a6",
    duration: { turns: k.traceParam(3, 2) },
    modifiers: [{ stat: "critRate", value: k.traceParam(3, 1) }],
  });
  // Lightning-Lord attacks with Jing Yuan's stats; its own CRIT DMG bonus is
  // carried by Jing Yuan and scoped to summon hits.
  const battaliaCrush = k.status({
    id: "battalia-crush",
    origin: "a2",
    modifiers: [
      {
        stat: "critDmg",
        value: k.traceParam(1, 2),
        filter: { attackerKinds: ["summon"] },
      },
    ],
  });
  const swingSkiesSquashed = k.status({
    id: "swing-skies-squashed",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.rankParam(2, 1),
        filter: { tags: ["basic", "skill", "ultimate"] },
      },
    ],
  });
  const vulnerable = k.status({
    id: "sweep-souls-slain",
    origin: "e6",
    debuff: true,
    maxStacks: k.rankParam(6, 2),
    modifiers: [{ stat: "vulnerability", value: k.rankParam(6, 1) }],
  });

  // Summons have a fixed engine SPD, but Lightning-Lord gains SPD with every
  // extra hit (tracker jing-yuan-lord-spd). The summon stays at base SPD and
  // its remaining gauge is rescaled by old/new SPD whenever the hit count
  // changes. Only policies see battle time, so they record it for the
  // abilities that run right after them.
  let now = 0;
  let lord: UnitView | null = null;
  /** Remaining gauge fraction at base SPD, as of `gaugeAt`. */
  let gauge = 1;
  let gaugeAt = 0;
  const lordSpeed = (hits: number) =>
    baseSpeed + speedPerHit * (hits - baseHits);

  const addHits = (ctx: BattleApi, amount: number) => {
    if (!lord) return;
    const current = lord.counter(HITS);
    const next = Math.min(maxHits, current + amount);
    if (next <= current) return;
    const remaining = Math.max(
      0,
      gauge - (now - gaugeAt) / actionValue(baseSpeed)
    );
    const rescaled = (remaining * lordSpeed(current)) / lordSpeed(next);
    ctx.advanceAction(lord, remaining - rescaled);
    gauge = rescaled;
    gaugeAt = now;
    ctx.setCounter(lord, HITS, next);
  };

  // Facts list the per-hit Toughness as `main`; a Bounce reads `each`.
  const strike: HitDef = {
    shape: "bounce",
    each: strikeMultiplier,
    bounces: 1,
    toughness: { each: 5 },
  };
  const lordAbilityId = (hits: number) => `lightning-lord-${hits}`;
  // One ability per Hits Per Action, so each hit is its own instance.
  const lordAbilities: AbilityDef[] = [];
  for (let hits = baseHits; hits <= maxHits; hits += 1) {
    lordAbilities.push({
      id: lordAbilityId(hits),
      kind: "followUp",
      hits: Array.from({ length: hits }, () => strike),
      before: (ctx) => {
        const owner = ctx.self.owner;
        if (owner && k.a(1) && hits >= k.traceParam(1, 1)) {
          ctx.applyStatus(owner, battaliaCrush);
        }
      },
      after: (ctx) => {
        const owner = ctx.self.owner;
        if (!owner) return;
        ctx.removeStatus(owner, battaliaCrush);
        if (k.e(4)) ctx.gainEnergy(owner, k.rankParam(4, 1) * hits);
        if (k.e(6)) {
          for (const enemy of ctx.enemies) ctx.removeStatus(enemy, vulnerable);
          ctx.setCounter(ctx.self, STRIKES, 0);
        }
        if (k.e(2)) ctx.applyStatus(owner, swingSkiesSquashed);
        ctx.setCounter(ctx.self, HITS, baseHits);
        gauge = 1;
        gaugeAt = now;
      },
    });
  }
  const lordAbilityIds = new Set(lordAbilities.map((ability) => ability.id));

  const lightningLord = k.summon({
    id: "lightning-lord",
    speed: baseSpeed,
    abilities: lordAbilities,
    policy: (view) => {
      now = view.time;
      const hits = Math.min(
        maxHits,
        Math.max(baseHits, view.self.counter(HITS))
      );
      return lordAbilityId(hits);
    },
  });

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    now = 0;
    gauge = 1;
    gaugeAt = 0;
    lord = ctx.summon(ctx.self, lightningLord.id);
    ctx.setCounter(lord, HITS, baseHits);
  });

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(2, 1))
    );
  }

  // Each strike picks a random primary target (a Bounce placement per enemy
  // weighted 1/n); its neighbours take the splash with the same weight.
  k.on("hit", "talent", { subject: "ally" }, (ctx, event) => {
    const primary = event.target;
    if (
      event.unit.owner !== ctx.self ||
      !event.abilityId ||
      !lordAbilityIds.has(event.abilityId) ||
      !isEnemy(primary)
    ) {
      return;
    }
    const index = ctx.enemies.indexOf(primary);
    const adjacent = [ctx.enemies[index - 1], ctx.enemies[index + 1]].filter(
      isEnemy
    );
    if (adjacent.length > 0) {
      ctx.deal(
        { shape: "aoe", each: splashMultiplier },
        {
          targets: adjacent,
          attacker: event.unit,
          tags: ["followUp"],
          abilityKind: "followUp",
          origin: "talent",
        }
      );
    }
    // E6 marks the primary target after each strike. Once a strike has been
    // placed on every enemy, each holds the expected capped number of strikes
    // it has taken so far in this action.
    if (k.e(6) && primary === ctx.enemies[ctx.enemies.length - 1]) {
      const strikes = event.unit.counter(STRIKES) + 1;
      ctx.setCounter(event.unit, STRIKES, strikes);
      const stacks = expectedCapped(
        strikes,
        1 / ctx.enemies.length,
        k.rankParam(6, 2)
      );
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, vulnerable, { setStacks: stacks });
      }
    }
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
    hits: [{ shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } }],
    after: (ctx) => {
      addHits(ctx, k.param("02", 2));
      if (k.a(3)) ctx.applyStatus(ctx.self, warMarshal);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => addHits(ctx, k.param("03", 2)),
  });

  // Skill every turn when possible: it feeds Lightning-Lord.
  k.policy({
    turn: (view) => {
      now = view.time;
      return preferSkill(view);
    },
    ultimate: (view) => {
      now = view.time;
      return true;
    },
  });
});
