import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef, StatusDef } from "../../kit/model";
import type { CombatType } from "../../model/stats";
import type { StatusFamily } from "../../model/tags";

const ATTACKING = "hysilens:attacking";
const HIT_THIS_ATTACK = "hysilens:hit";
const ZONE_TRIGGERS = "hysilens:zone-triggers";
const ROTATION = "hysilens:rotation";

/** Hysilens — Nihility, Physical. */
export default defineCharacter("1410", (k) => {
  // Talent states: Wind Shear, Bleed, Burn, Shock. Bleed deals #3% of the
  // enemy's Max HP capped at #4% of ATK; enemy HP is not modeled and
  // endgame enemies reach the cap.
  const states: readonly {
    id: string;
    family: StatusFamily;
    combatType: CombatType;
    main: number;
  }[] = [
    {
      id: "wind-shear",
      family: "windShear",
      combatType: "Wind",
      main: k.param("04", 2),
    },
    {
      id: "bleed",
      family: "bleed",
      combatType: "Physical",
      main: k.param("04", 4),
    },
    { id: "burn", family: "burn", combatType: "Fire", main: k.param("04", 2) },
    {
      id: "shock",
      family: "shock",
      combatType: "Thunder",
      main: k.param("04", 2),
    },
  ];
  const talentDot = (
    id: string,
    origin: "talent" | "e1",
    family: StatusFamily,
    combatType: CombatType,
    main: number
  ): StatusDef =>
    k.status({
      id,
      origin,
      family,
      debuff: true,
      duration: { turns: k.param("04", 5) },
      dot: { hit: { shape: "single", main, kind: "dot", combatType } },
    });
  const dots = states.map((state) => ({
    status: talentDot(
      state.id,
      "talent",
      state.family,
      state.combatType,
      state.main
    ),
    // E1: a second instance of the same state that coexists with the first.
    extra: k.e(1)
      ? talentDot(
          `${state.id}-e1`,
          "e1",
          state.family,
          state.combatType,
          state.main
        )
      : null,
  }));

  const inflictTalentState = (ctx: BattleApi, target: EnemyView) => {
    // Priority to a state the enemy does not have yet; otherwise refresh
    // them in turn.
    let choice = dots.find((dot) => !target.has(dot.status));
    if (!choice) {
      const index = target.counter(ROTATION) % dots.length;
      ctx.setCounter(target, ROTATION, index + 1);
      choice = dots[index];
    }
    if (!choice) return;
    ctx.applyStatus(target, choice.status, { baseChance: k.param("04", 1) });
    if (choice.extra) {
      ctx.applyStatus(target, choice.extra, { baseChance: k.rankParam(1, 2) });
    }
  };

  // "This duration decreases by 1 at the start of this unit's every turn."
  const zoneDuration = {
    turns: k.param("03", 2),
    countdown: "turnStart" as const,
    clock: "applier" as const,
  };
  const zone = k.status({
    id: "zone",
    origin: "ultimate",
    duration: zoneDuration,
  });
  // Zone effects on enemies (the ATK reduction only affects damage taken by
  // allies and is not modeled). They are field effects, not debuffs.
  const zoneDef = k.status({
    id: "zone-def",
    origin: "ultimate",
    duration: zoneDuration,
    modifiers: [{ stat: "defReduction", value: k.param("03", 3) }],
  });
  const zoneRes = k.e(4)
    ? k.status({
        id: "zone-res",
        origin: "e4",
        duration: zoneDuration,
        modifiers: [{ stat: "resReduction", value: k.rankParam(4, 1) }],
      })
    : null;

  // A6: DMG +#3 per #2 Effect Hit Rate above #1, up to #4.
  const pearlsScaling = (source: "holder" | "applier") => ({
    source,
    stat: "effectHitRate" as const,
    threshold: k.traceParam(3, 1),
    step: k.traceParam(3, 2),
    ratio: k.traceParam(3, 3),
    cap: k.traceParam(3, 4),
  });
  if (k.a(3)) {
    k.stat("a6", { stat: "dmgBoost", scaling: pearlsScaling("holder") });
  }
  const sharedPearls =
    k.a(3) && k.e(2)
      ? k.status({
          id: "fiddle-of-pearls-allies",
          origin: "e2",
          duration: zoneDuration,
          modifiers: [{ stat: "dmgBoost", scaling: pearlsScaling("applier") }],
        })
      : null;

  if (k.e(1)) {
    k.teamStat("e1", {
      stat: "dmgMultiplier",
      value: k.rankParam(1, 1) - 1,
      filter: { tags: ["dot"] },
    });
  }

  const deployZone = (ctx: BattleApi, turns: number) => {
    ctx.applyStatus(ctx.self, zone, { turns });
    for (const enemy of ctx.enemies) {
      ctx.applyStatus(enemy, zoneDef, { turns });
      if (zoneRes) ctx.applyStatus(enemy, zoneRes, { turns });
    }
    if (sharedPearls) {
      for (const ally of ctx.allies) {
        if (ally !== ctx.self) ctx.applyStatus(ally, sharedPearls, { turns });
      }
    }
    if (k.a(1)) ctx.gainSkillPoints(k.traceParam(1, 2));
  };

  if (k.a(1)) {
    k.on("battleStart", "a2", { subject: "any" }, (ctx) =>
      deployZone(ctx, k.traceParam(1, 1))
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  const skillVulnerability = k.status({
    id: "overtone-hum",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 4) },
    modifiers: [{ stat: "vulnerability", value: k.param("02", 3) }],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, skillVulnerability, {
          baseChance: k.param("02", 2),
        });
      }
    },
    hits: [{ shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } }],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => deployZone(ctx, k.param("03", 2)),
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      if (!k.a(2)) return;
      for (const enemy of ctx.enemies) {
        ctx.detonateDots(enemy, k.traceParam(2, 1));
      }
    },
  });

  // Talent: every enemy hit by an ally attack gets one state per attack.
  k.on("actionStart", "talent", { subject: "ally" }, (ctx, event) => {
    ctx.setCounter(ctx.self, ATTACKING, event.attack ? 1 : 0);
    for (const enemy of ctx.enemies) {
      ctx.setCounter(enemy, HIT_THIS_ATTACK, 0);
      ctx.setCounter(enemy, ZONE_TRIGGERS, 0);
    }
  });
  k.on("actionEnd", "talent", { subject: "ally" }, (ctx) =>
    ctx.setCounter(ctx.self, ATTACKING, 0)
  );
  k.on("hit", "talent", { subject: "ally" }, (ctx, event) => {
    const target = event.target;
    if (ctx.self.counter(ATTACKING) === 0 || !isEnemy(target)) return;
    if (event.tags?.includes("dot") || target.counter(HIT_THIS_ATTACK) > 0) {
      return;
    }
    ctx.setCounter(target, HIT_THIS_ATTACK, 1);
    inflictTalentState(ctx, target);
  });

  // Zone: every DoT instance an enemy takes adds a Physical DoT from
  // Hysilens, up to the cap per enemy turn start or per ally attack. The
  // Zone DoT itself is dealt directly, so it never retriggers.
  const zoneHit: HitDef = {
    shape: "single",
    main: k.param("03", 4) + (k.e(6) ? k.rankParam(6, 2) : 0),
    kind: "dot",
    combatType: "Physical",
    onlyTags: ["dot"],
  };
  const zoneCap = k.e(6) ? k.rankParam(6, 1) : k.param("03", 5);
  k.on("turnStart", "ultimate", { subject: "enemy" }, (ctx, event) =>
    ctx.setCounter(event.unit, ZONE_TRIGGERS, 0)
  );
  k.on("dotTick", "ultimate", { subject: "enemy" }, (ctx, event) => {
    const enemy = event.unit;
    if (!ctx.self.has(zone) || !isEnemy(enemy) || ctx.weight <= 0) return;
    if (enemy.counter(ZONE_TRIGGERS) >= zoneCap) return;
    ctx.setCounter(enemy, ZONE_TRIGGERS, enemy.counter(ZONE_TRIGGERS) + 1);
    // dotTick carries the detonation ratio as its weight; each detonated
    // DoT still counts as one full instance.
    ctx.deal(
      { ...zoneHit, main: (zoneHit.main ?? 0) / ctx.weight },
      { targets: [enemy], origin: "ultimate", tags: ["dot"] }
    );
  });
});
