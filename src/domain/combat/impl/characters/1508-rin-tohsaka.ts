import {
  type BattleApi,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

const ARCHER = "1015";
const GEM = "gem-energy";
const SHADOW_GEM = "shadow-gem";
const SEEN_SKILL_POINTS = "skill-points-seen";

/**
 * Rin Tohsaka — Erudition, Quantum.
 *
 * The reference data has no Toughness/Energy facts for this Character yet:
 * Toughness and follow-up Energy below use the usual values for each shape.
 */
export default defineCharacter("1508", (k) => {
  const archerInTeam = k.team.some((member) => member.characterId === ARCHER);
  // Unused #6 of "Gem Magecraft" (999) is read as the "Gem Energy" cap.
  const gemCap = k.param("04", 6);

  const allyCritDmg = k.status({
    id: "gem-magecraft-crit-dmg",
    origin: "talent",
    duration: { turns: k.param("04", 2) },
    modifiers: [{ stat: "critDmg", value: k.param("04", 3) }],
  });
  // E4: on Rin herself the same boost stacks.
  const selfCritDmg = k.status({
    id: "gem-magecraft-crit-dmg-self",
    origin: "talent",
    duration: { turns: k.param("04", 2) },
    maxStacks: k.e(4) ? k.rankParam(4, 1) : 1,
    modifiers: [{ stat: "critDmg", value: k.param("04", 3) }],
  });
  const vulnerability = k.status({
    id: "an-gal-ta-vulnerability",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 6) },
    modifiers: [{ stat: "vulnerability", value: k.param("03", 5) }],
  });
  const a4Spd = k.status({
    id: "ladylike-poise-spd",
    origin: "a4",
    duration: { turns: k.traceParam(2, 2) },
    modifiers: [{ stat: "spdPct", value: k.traceParam(2, 1) }],
  });

  const gainGem = (ctx: BattleApi, amount: number) => {
    const current = ctx.self.counter(GEM);
    ctx.setCounter(ctx.self, GEM, Math.min(gemCap, current + amount));
  };

  // Skill Point changes have no event: compare against the last value seen
  // at every action and turn boundary and credit the unit acting there.
  const syncSkillPoints = (ctx: BattleApi, unit: UnitView) => {
    const delta = ctx.skillPoints - ctx.self.counter(SEEN_SKILL_POINTS);
    ctx.setCounter(ctx.self, SEEN_SKILL_POINTS, ctx.skillPoints);
    if (Math.abs(delta) < 1e-9) return;
    gainGem(ctx, Math.abs(delta));
    const holder = unit.kind === "summon" && unit.owner ? unit.owner : unit;
    if (holder.kind === "enemy") return;
    ctx.applyStatus(holder, holder === ctx.self ? selfCritDmg : allyCritDmg);
  };
  for (const event of [
    "actionStart",
    "actionEnd",
    "turnStart",
    "turnEnd",
  ] as const) {
    k.on(event, "talent", { subject: "any" }, (ctx, battleEvent) =>
      syncSkillPoints(ctx, battleEvent.unit)
    );
  }

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.setCounter(ctx.self, SEEN_SKILL_POINTS, ctx.skillPoints);
    gainGem(ctx, k.param("04", 1));
    if (k.a(2)) ctx.applyStatus(ctx.self, a4Spd);
  });

  if (k.a(1)) {
    // The +2 Skill Point cap is an engine option (not modeled).
    k.stat("a2", { stat: "atkPct", value: k.traceParam(1, 2) });
    k.stat("a2", {
      stat: "resPen",
      value: k.traceParam(1, 3),
      filter: { combatTypes: ["Quantum"] },
    });
    if (archerInTeam) {
      const archerBuff = k.status({
        id: "elegant-conduct-archer",
        origin: "a2",
        modifiers: [
          { stat: "atkPct", value: k.traceParam(1, 2) },
          {
            stat: "resPen",
            value: k.traceParam(1, 3),
            filter: { combatTypes: ["Quantum"] },
          },
        ],
      });
      k.on("battleStart", "a2", { subject: "any" }, (ctx) => {
        for (const ally of ctx.allies) {
          if (ally.kind === "character" && ally.definitionId === ARCHER) {
            ctx.applyStatus(ally, archerBuff);
          }
        }
      });
    }
  }
  if (k.e(2)) {
    k.stat("e2", {
      stat: "dmgBoost",
      value: k.rankParam(2, 1),
      filter: { tags: ["skill"] },
    });
    k.teamStat("e2", {
      stat: "dmgMultiplier",
      value: k.rankParam(2, 2) - 1,
      filter: { tags: ["skill"] },
    });
  }
  if (k.e(6)) k.stat("e6", { stat: "resPen", value: k.rankParam(6, 1) });

  // "X% to one designated enemy and Y% to other enemies": Blast covers the
  // adjacent ones; enemies two or more away get the remainder by deal().
  const beyondAdjacent = (ctx: BattleApi, main: EnemyView) => {
    const index = ctx.enemies.indexOf(main);
    return ctx.enemies.filter((_, other) => Math.abs(other - index) >= 2);
  };

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
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
  });

  // "Second Magic Experiment": the number of random follow-up instances is
  // known only when cast, so its hits are rebuilt in `before`.
  const gemPerInstance = k.param("09", 2);
  const aoeHit: HitDef = {
    shape: "aoe",
    each: k.param("09", 1),
    toughness: { each: 10 },
  };
  const enhancedHits: HitDef[] = [aoeHit];
  const enhancedReady = (self: UnitView, skillPoints: number) =>
    self.counter(SHADOW_GEM) > 0 ||
    self.counter(GEM) >= k.param("04", 5) ||
    skillPoints >= k.param("04", 4);

  k.ability({
    id: "enhancedSkill",
    kind: "skill",
    before: (ctx) => {
      let instances: number;
      const shadow = ctx.self.counter(SHADOW_GEM);
      if (shadow > 0) {
        // E1: consumes all "Shadow Gem" instead of "Gem Energy".
        instances = Math.min(
          k.param("09", 6),
          Math.floor(shadow / gemPerInstance)
        );
        ctx.setCounter(ctx.self, SHADOW_GEM, 0);
      } else {
        const excess = ctx.skillPoints - k.param("09", 4);
        if (excess > 0) {
          ctx.gainSkillPoints(-excess);
          gainGem(ctx, excess * k.param("09", 5));
          // The Talent also counts these consumed Skill Points.
          syncSkillPoints(ctx, ctx.self);
        }
        const gem = ctx.self.counter(GEM);
        instances = Math.min(
          k.param("09", 6),
          Math.floor(gem / gemPerInstance)
        );
        const consumed = instances * gemPerInstance;
        ctx.setCounter(ctx.self, GEM, gem - consumed);
        if (k.e(1) && consumed >= k.rankParam(1, 1)) {
          ctx.setCounter(ctx.self, SHADOW_GEM, consumed);
        }
      }
      enhancedHits.splice(0, enhancedHits.length, aoeHit);
      if (instances > 0) {
        enhancedHits.push({
          shape: "bounce",
          each: k.param("09", 3),
          bounces: instances,
        });
      }
    },
    hits: enhancedHits,
    after: (ctx) => {
      if (k.a(2)) ctx.applyStatus(ctx.self, a4Spd);
    },
  });

  const otherMultiplier = k.param("03", 2);
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      ctx.gainSkillPoints(k.param("03", 4));
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, vulnerability);
      if (k.a(3)) gainGem(ctx, k.traceParam(3, 1));
      if (k.e(6)) gainGem(ctx, k.rankParam(6, 2));
    },
    hits: [
      {
        shape: "blast",
        main: k.param("03", 1),
        adjacent: otherMultiplier,
        toughness: { main: 20, adjacent: 20 },
      },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) {
        const rest = beyondAdjacent(ctx, ctx.target);
        if (rest.length > 0) {
          ctx.deal(
            { shape: "aoe", each: otherMultiplier, toughness: { each: 20 } },
            {
              targets: rest,
              tags: ["ultimate"],
              abilityKind: "ultimate",
              origin: "ultimate",
            }
          );
        }
      }
      if (k.e(6)) ctx.grantExtraTurn(ctx.self);
    },
  });

  if (archerInTeam) {
    const jointTags = ["followUp", "joint"] as const;
    k.ability({
      id: "jointFollowUp",
      kind: "followUp",
      tags: jointTags,
      energy: 10,
      hits: [{ shape: "aoe", each: k.param("05", 1), toughness: { each: 10 } }],
      after: (ctx) => {
        const archer = ctx.allies.find(
          (ally) => ally.kind === "character" && ally.definitionId === ARCHER
        );
        if (archer) {
          ctx.deal(
            { shape: "aoe", each: k.param("05", 4) },
            {
              attacker: archer,
              tags: jointTags,
              abilityKind: "followUp",
              origin: "talent",
            }
          );
        }
        ctx.gainSkillPoints(k.param("05", 2));
      },
    });
    // Archer's "Circuit Connection" keeps his turn going between Skills, so
    // Skills used within one of his turns stand in for its active uses.
    k.on("turnStart", "talent", { subject: "otherAlly" }, (ctx, event) => {
      if (event.unit.definitionId === ARCHER) {
        ctx.setCounter(ctx.self, "archer-skills", 0);
      }
    });
    k.on(
      "actionEnd",
      "talent",
      { subject: "otherAlly", abilityKinds: ["skill"], attack: true },
      (ctx, event) => {
        if (event.unit.definitionId !== ARCHER || event.abilityId !== "skill") {
          return;
        }
        const used = ctx.self.counter("archer-skills") + 1;
        ctx.setCounter(ctx.self, "archer-skills", used);
        if (ctx.self.counter("joint-used") > 0) return;
        // "5 times" has no placeholder.
        if (ctx.skillPoints > k.param("05", 3) && used < 5) return;
        ctx.setCounter(ctx.self, "joint-used", 1);
        ctx.queueAction(ctx.self, "jointFollowUp", {
          target: isEnemy(event.target) ? event.target : undefined,
        });
      }
    );
    k.on("turnEnd", "talent", { subject: "self" }, (ctx) =>
      ctx.setCounter(ctx.self, "joint-used", 0)
    );
  }

  // Basic ATK feeds Skill Points (and Gems) until the Enhanced Skill is ready;
  // it then converts the surplus Skill Points.
  k.policy({
    turn: (view) =>
      view.skillPoints >= 1 && enhancedReady(view.self, view.skillPoints)
        ? "enhancedSkill"
        : "basic",
  });
});
