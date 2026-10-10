import type { ActionContext, BattleApi, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

const USES = "himeko-nova:assist-uses";
const SOURCE = "source-energy";

/**
 * "Trailblaze Companions" are not listed in the reference data. Assumed: the
 * Astral Express crew (March 7th, Dan Heng, Welt, and the Trailblazer).
 */
const TRAILBLAZE_COMPANIONS: ReadonlySet<string> = new Set([
  "1001",
  "1224",
  "1002",
  "1213",
  "1414",
  "1004",
  "8001",
  "8002",
  "8003",
  "8004",
  "8005",
  "8006",
  "8007",
  "8008",
  "8009",
  "8010",
]);

/** Himeko • Nova — Erudition, Fire. */
export default defineCharacter("1510", (k) => {
  const semaphore = k.status({
    id: "navigators-semaphore",
    origin: "skill",
    // "This duration decreases by 1 at the start of Himeko • Nova's every turn."
    duration: {
      turns: k.param("02", 2),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: [{ stat: "dmgBoost", value: k.param("02", 1) }],
  });
  // E2 and E6 scale "Assist Skill" DMG, which has no damage tag: the bonus
  // is held only while an Assist Skill resolves.
  const assistDmg =
    k.e(2) || k.e(6)
      ? k.status({
          id: "assist-skill-dmg",
          origin: k.e(6) ? "e6" : "e2",
          modifiers: [
            ...(k.e(2)
              ? [
                  {
                    stat: "dmgMultiplier" as const,
                    value: k.rankParam(2, 1) - 1,
                  },
                ]
              : []),
            ...(k.e(6)
              ? [{ stat: "dmgBoost" as const, value: k.rankParam(6, 3) }]
              : []),
          ],
        })
      : null;

  const sourceCap = k.e(6) ? k.rankParam(6, 2) : k.param("08", 3);
  const gainSource = (ctx: BattleApi, amount: number) =>
    ctx.setCounter(
      ctx.self,
      SOURCE,
      Math.min(sourceCap, ctx.self.counter(SOURCE) + amount)
    );

  const characters = (ctx: BattleApi) =>
    ctx.allies.filter((ally) => ally.kind === "character");
  const usesCap = (ctx: BattleApi, unit: UnitView) =>
    unit === ctx.self && k.e(2) ? 2 : 1;
  const recoverUses = (ctx: BattleApi, unit: UnitView, amount: number) =>
    ctx.setCounter(
      unit,
      USES,
      Math.min(usesCap(ctx, unit), unit.counter(USES) + amount)
    );

  // Talent: Himeko • Nova's CRIT DMG and All-Type RES PEN. E4 extends the
  // RES PEN to every ally and adds more for her.
  k.stat("talent", { stat: "critDmg", value: k.param("04", 1) });
  k.stat("talent", { stat: "resPen", value: k.param("04", 2) });
  if (k.e(4)) {
    k.teamStat(
      "e4",
      { stat: "resPen", value: k.param("04", 2) },
      "otherAllies"
    );
    k.stat("e4", { stat: "resPen", value: k.rankParam(4, 1) });
  }
  if (k.e(2)) {
    k.stat("e2", {
      stat: "dmgMultiplier",
      value: k.rankParam(2, 1) - 1,
      filter: { tags: ["ultimate"] },
    });
  }
  if (k.e(6)) {
    k.stat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 1),
      filter: { combatTypes: ["Fire"] },
    });
  }

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    for (const ally of characters(ctx)) ctx.setCounter(ally, USES, 1);
  });

  // Assist Skill uses come back at turn starts during "Navigator's
  // Semaphore". Other allies spend theirs at their turn start; Himeko • Nova
  // calls the attack as her own action. Assist Skill is modeled as free for
  // allies whose A4 extra turn gives the action back: Trailblaze Companions,
  // or anyone at E2. Other allies would trade their own action for it, which
  // the engine cannot express, so they do not use it.
  k.on("turnStart", "talent", { subject: "ally" }, (ctx, event) => {
    const unit = event.unit;
    if (unit.kind !== "character") return;
    if (ctx.self.has(semaphore)) recoverUses(ctx, unit, k.e(2) ? 2 : 1);
    if (unit === ctx.self) {
      if (k.a(1) && unit.counter(USES) >= usesCap(ctx, unit)) {
        ctx.gainEnergy(ctx.self, k.traceParam(1, 1));
      }
      return;
    }
    const freeAction =
      k.a(2) && (k.e(2) || TRAILBLAZE_COMPANIONS.has(unit.definitionId));
    if (!freeAction || unit.counter(USES) < 1) return;
    ctx.setCounter(unit, USES, unit.counter(USES) - 1);
    ctx.gainEnergy(unit, k.param("04", 3));
    ctx.queueAction(ctx.self, "allyAssist");
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
    target: "allies",
    after: (ctx) => {
      for (const ally of characters(ctx)) {
        ctx.setCounter(ally, USES, usesCap(ctx, ally));
      }
      for (const ally of ctx.allies) ctx.applyStatus(ally, semaphore);
    },
  });

  // "Using Assist Skill is considered as Himeko • Nova using her Skill": both
  // variants are her Skill-kind actions, but their DMG is Assist Skill DMG
  // (not Skill DMG), hence no tags. Facts: Toughness 10 for the AoE part and
  // 5 per random instance; Energy 18 for her own use (others get the
  // Talent's Energy instead).
  const startAssist = (ctx: ActionContext) => {
    if (assistDmg) ctx.applyStatus(ctx.self, assistDmg);
    if (k.e(6)) gainSource(ctx, 1);
  };
  const endAssist = (ctx: ActionContext) => {
    if (assistDmg) ctx.removeStatus(ctx.self, assistDmg);
  };
  const assistHits = (
    aoe: number,
    instances: number,
    each: number
  ): HitDef[] => [
    { shape: "aoe", each: aoe, toughness: { each: 10 } },
    { shape: "bounce", each, bounces: instances, toughness: { each: 5 } },
  ];

  k.ability({
    id: "assistSkill",
    kind: "skill",
    tags: [],
    skillPoints: 0,
    energy: 18,
    before: (ctx) => {
      // A2: her own Assist Skill does not consume uses.
      if (!k.a(1)) {
        ctx.setCounter(ctx.self, USES, Math.max(0, ctx.self.counter(USES) - 1));
      }
      startAssist(ctx);
    },
    hits: assistHits(
      k.param("22", 4),
      k.param("22", 5) + (k.e(1) ? k.rankParam(1, 3) : 0),
      k.param("22", 6)
    ),
    after: endAssist,
  });

  k.ability({
    id: "allyAssist",
    kind: "skill",
    tags: [],
    skillPoints: 0,
    energy: 0,
    before: startAssist,
    hits: assistHits(k.param("22", 1), k.param("22", 2), k.param("22", 3)),
    after: endAssist,
  });

  // Ultimate: "Starblazer" fires 6 "Hyperluminal Particle Beams" (no
  // placeholder) and "Orbital Annihilation Pulses" in the order the player
  // picks. Modeled play: Pulse whenever "Source Energy" is full, then the
  // automatic Pulse and Final Hit. Toughness per facts: 2 per Beam/Pulse
  // target and Pulse instance, 4 per Final Hit instance (48 in total).
  const beamCount = 6;
  const beamSource = k.param("08", 2) + (k.e(6) ? 1 : 0);
  const ultimateHits: HitDef[] = [];
  const planUltimate = (start: number) => {
    const hits: HitDef[] = [];
    let source = start;
    const pulse = () => {
      hits.push({
        shape: "aoe",
        each: k.param("09", 1),
        toughness: { each: 2 },
      });
      // "When the current Source Energy is more than 1, for every 1 point
      // consumed": all points are consumed, one random instance each.
      if (source > 1) {
        const boosted = k.a(3) && source >= k.traceParam(3, 2);
        hits.push({
          shape: "bounce",
          each: k.param("09", 3) + (boosted ? k.traceParam(3, 3) : 0),
          bounces: Math.floor(source / k.param("09", 2)),
          toughness: { each: 2 },
        });
      }
      if (k.e(6) && source >= k.rankParam(6, 4)) {
        hits.push({ shape: "aoe", each: k.rankParam(6, 5) });
      }
      source = 0;
    };
    let beams = beamCount;
    while (beams > 0) {
      if (source >= sourceCap) {
        pulse();
        continue;
      }
      hits.push({
        shape: "aoe",
        each: k.param("08", 1),
        toughness: { each: 2 },
      });
      beams -= 1;
      source = Math.min(sourceCap, source + beamSource);
    }
    if (source > 0) pulse();
    hits.push({
      shape: "bounce",
      each: k.param("03", 7),
      bounces: k.param("03", 6),
      toughness: { each: 4 },
    });
    return hits;
  };
  ultimateHits.push(...planUltimate(0));

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (k.a(3)) gainSource(ctx, k.traceParam(3, 1));
      ultimateHits.splice(
        0,
        ultimateHits.length,
        ...planUltimate(ctx.self.counter(SOURCE))
      );
      ctx.setCounter(ctx.self, SOURCE, 0);
    },
    hits: ultimateHits,
  });

  // Skill to keep "Navigator's Semaphore" up; otherwise her own Assist Skill.
  k.policy({
    turn: (view) => {
      if (!view.self.has(semaphore) && view.skillPoints >= 1) return "skill";
      if (k.a(1) || view.self.counter(USES) >= 1) return "assistSkill";
      return "basic";
    },
  });
});
