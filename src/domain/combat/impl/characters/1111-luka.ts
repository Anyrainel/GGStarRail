import {
  type BattleApi,
  type EnemyView,
  isEnemy,
  type PolicyView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef, StatusDef } from "../../kit/model";

/** Luka — Nihility, Physical. */
export default defineCharacter("1111", (k) => {
  // "...up to 4 stacks." / "At the start of battle, Luka will possess 1
  // stack of Fighting Will." (no parameters)
  const fightingWill = k.status({
    id: "fighting-will",
    origin: "talent",
    maxStacks: 4,
  });
  const neverTurningBack = k.status({
    id: "never-turning-back",
    origin: "e4",
    maxStacks: k.rankParam(4, 2),
    modifiers: [{ stat: "atkPct", value: k.rankParam(4, 1) }],
  });

  // Bleed deals #3% of the enemy's Max HP capped at #4% of Luka's ATK.
  // Enemy HP is not modeled; endgame enemies reach the cap.
  const bleed = k.status({
    id: "bleed",
    family: "bleed",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 5) },
    dot: {
      hit: {
        shape: "single",
        main: k.param("02", 4),
        kind: "dot",
        combatType: "Physical",
      },
    },
  });
  // Detonations and "is Bleeding" checks cover any Bleed (Weakness Break,
  // other Characters): a Physical DoT. Statuses have no DoT family, so
  // Bleeds are recognized by Combat Type and collected as they are applied.
  const isBleed = (status: StatusDef | undefined) =>
    status?.dot?.hit.combatType === "Physical";
  const knownBleeds = new Set<StatusDef>([bleed]);
  k.on("statusApplied", "talent", { subject: "any" }, (_ctx, event) => {
    if (event.status && isBleed(event.status)) knownBleeds.add(event.status);
  });
  const bleeding = (enemy: EnemyView) =>
    [...knownBleeds].some((status) => enemy.has(status));

  const vulnerability = k.status({
    id: "coup-de-grace",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 4) },
    modifiers: [{ stat: "vulnerability", value: k.param("03", 3) }],
  });

  const fightingEndlessly = k.status({
    id: "fighting-endlessly",
    origin: "e1",
    duration: { turns: k.rankParam(1, 2) },
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(1, 1) }],
  });

  const gainFightingWill = (ctx: BattleApi, stacks: number) => {
    const before = ctx.self.stacks(fightingWill);
    ctx.applyStatus(ctx.self, fightingWill, { stacks });
    const gained = ctx.self.stacks(fightingWill) - before;
    if (gained <= 0) return;
    if (k.a(2)) ctx.gainEnergy(ctx.self, k.traceParam(2, 1) * gained);
    if (k.e(4)) {
      ctx.applyStatus(ctx.self, neverTurningBack, { stacks: gained });
    }
  };

  k.on("battleStart", "talent", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, fightingWill, { setStacks: 1 })
  );

  if (k.e(1)) {
    k.on("actionStart", "e1", { subject: "self" }, (ctx, event) => {
      if (isEnemy(event.target) && bleeding(event.target)) {
        ctx.applyStatus(ctx.self, fightingEndlessly);
      }
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => gainFightingWill(ctx, k.param("04", 1)),
  });

  // Sky-Shatter Fist: 3 Direct Punch hits, then Rising Uppercut. The
  // ability's 20 Toughness is split by multiplier (the per-hit split is not
  // in the data). A6 adds an expected #1 extra hit per punch.
  const punch = k.param("08", 1);
  const uppercut = k.param("08", 2);
  const punchToughness = (20 * punch) / (3 * punch + uppercut);
  const extraPunch = k.a(3) ? k.traceParam(3, 1) : 0;
  const punchHits: HitDef[] = [];
  for (let index = 0; index < 3; index += 1) {
    punchHits.push({
      shape: "single",
      main: punch,
      toughness: { main: punchToughness },
    });
    if (extraPunch > 0) {
      punchHits.push({
        shape: "single",
        main: punch * extraPunch,
        toughness: { main: punchToughness * extraPunch },
      });
    }
  }
  const punchesThrown = 3 * (1 + extraPunch);

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    before: (ctx) => ctx.consumeStacks(ctx.self, fightingWill, 2),
    hits: [
      ...punchHits,
      {
        shape: "single",
        main: uppercut,
        toughness: { main: 20 - 3 * punchToughness },
      },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target) || !bleeding(ctx.target)) return;
      ctx.detonateDots(ctx.target, k.param("04", 2), { filter: isBleed });
      if (k.e(6)) {
        ctx.detonateDots(ctx.target, k.rankParam(6, 1) * punchesThrown, {
          filter: isBleed,
        });
      }
    },
  });

  // A2's buff dispel has no target: enemy buffs are not modeled.
  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      ctx.applyStatus(ctx.target, bleed, { baseChance: k.param("02", 2) });
      gainFightingWill(ctx, k.param("04", 1));
      if (k.e(2) && ctx.target.weaknesses.has("Physical")) {
        gainFightingWill(ctx, k.rankParam(2, 1));
      }
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      gainFightingWill(ctx, k.param("03", 5));
      if (isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, vulnerability, {
          baseChance: k.param("03", 2),
        });
      }
    },
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
  });

  const mainTarget = (view: PolicyView): EnemyView | undefined =>
    view.enemies[Math.floor((view.enemies.length - 1) / 2)];

  k.policy({
    // Skill keeps Bleed up and builds Fighting Will; Sky-Shatter Fist spends
    // it on a Bleeding target (or whenever no Skill Point is left).
    turn: (view) => {
      const enhanced = view.self.stacks(fightingWill) >= 2;
      const target = mainTarget(view);
      if (enhanced && (view.skillPoints < 1 || (target && bleeding(target)))) {
        return "enhancedBasic";
      }
      return view.skillPoints >= 1 ? "skill" : "basic";
    },
  });
});
