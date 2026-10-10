import { canonicalCharacterId } from "@/domain/characterIdentity";
import {
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

// Characters with a dedicated "Ode" from Demiurge (Chrysos Heirs).
const CHRYSOS_HEIRS = new Set([
  "1402", // Aglaea
  "1403", // Tribbie
  "1404", // Mydei
  "1405", // Anaxa
  "1406", // Cipher
  "1407", // Castorice
  "1408", // Phainon
  "1409", // Hyacine
  "1410", // Hysilens
  "1412", // Cerydra
  "1413", // Evernight
  "1414", // Dan Heng • Permansor Terrae
  "8007", // Trailblazer (Remembrance)
]);
const SUPPORT_PATHS = new Set(["Shaman", "Priest", "Knight"]);
// Supports on other Paths whose Ode is better spent on the damage dealer.
const SUPPORT_IDS = new Set(["1409", "1512", "8007"]);

/** Cyrene — Remembrance, Ice. */
export default defineCharacter("1415", (k) => {
  const DEMIURGE = "11415";
  const RECOLLECTION = "recollection";
  const STORY = "story";
  const AUTO_MINUET = "auto-minuet";
  const ZONE_TURNS = "zone-turns";
  const ODE_USED = "ode-used";
  const SOURCES = "recollection-sources";
  const ODE_TARGETS = "ode-targets";
  const EGO_TRIGGERS = "ego-triggers";
  const MINUET_USES = "minuet-uses";
  const sourceKey = (unit: UnitView) => `recollection-from:${unit.id}`;
  const odeKey = (unit: UnitView) => `ode-to:${unit.id}`;

  // Demiurge's Max HP equals Cyrene's; memosprites read the owner's panel.
  const demiurgeHp = k.param("03", 1);
  const recollectionCap = k.param("04", 3);

  const zoneMarker = k.status({ id: "zone", origin: "skill" });
  const zone = k.status({
    id: "zone-true-dmg",
    origin: "skill",
    modifiers: [{ stat: "trueDmg", value: k.param("02", 1) }],
  });
  // Applied from Cyrene's and Demiurge's actions; one Zone, one copy.
  const zoneE2 = k.status({
    id: "zone-true-dmg-e2",
    origin: "e2",
    unique: true,
    maxStacks: Math.round(k.rankParam(2, 4) / k.rankParam(2, 3)),
    modifiers: [{ stat: "trueDmg", value: k.rankParam(2, 3) }],
  });
  const ripples = k.status({
    id: "ripples-of-past-reverie",
    origin: "ultimate",
  });
  const ripplesCrit = k.status({
    id: "ripples-crit-rate",
    origin: "ultimate",
    modifiers: [{ stat: "critRate", value: k.param("03", 3) }],
  });
  const future = k.status({ id: "future", origin: "talent" });
  const waiting = k.status({
    id: "waiting-in-every-past",
    origin: "memospriteTalent",
    modifiers: [{ stat: "hpPct", value: k.param("1141503", 1) }],
  });
  const e6Def = k.status({
    id: "e6-def",
    origin: "e6",
    debuff: true,
    modifiers: [{ stat: "defReduction", value: k.rankParam(6, 2) }],
  });

  // "This Ode, to All Lives" and the Chrysos Heir Odes that only need
  // stats. Odes that change another kit's own mechanics are not modeled.
  const odeDmg = k.status({
    id: "ode-to-all-lives",
    origin: "memospriteSkill",
    duration: { turns: k.param("1141502", 3) },
    modifiers: [{ stat: "dmgBoost", value: k.param("1141502", 2) }],
  });
  // Demiurge's CRIT Rate includes the Ultimate's bonus: Demiurge only
  // exists after the Ultimate, so Ripples is always active.
  const genesis = k.status({
    id: "ode-to-genesis",
    origin: "memospriteSkill",
    modifiers: [
      {
        stat: "atkFlat",
        scaling: {
          source: "applier",
          stat: "hp",
          ratio: k.param("1141513", 1) * demiurgeHp,
        },
      },
      {
        stat: "critRate",
        value: k.param("1141513", 2) * k.param("03", 3),
        scaling: {
          source: "applier",
          stat: "critRate",
          ratio: k.param("1141513", 2),
        },
      },
    ],
  });
  const passage = k.status({
    id: "ode-to-passage",
    origin: "memospriteSkill",
    modifiers: [{ stat: "defIgnore", value: k.param("1141515", 2) }],
  });
  const trickery = k.status({
    id: "ode-to-trickery",
    origin: "memospriteSkill",
    modifiers: [{ stat: "dmgBoost", value: k.param("1141520", 1) }],
  });
  // The Patron is Cipher's marked enemy; the designated target stands in.
  const trickeryPatron = k.status({
    id: "ode-to-trickery-patron",
    origin: "memospriteSkill",
    debuff: true,
    modifiers: [{ stat: "defReduction", value: k.param("1141520", 2) }],
  });
  const trickeryOthers = k.status({
    id: "ode-to-trickery-others",
    origin: "memospriteSkill",
    debuff: true,
    modifiers: [{ stat: "defReduction", value: k.param("1141520", 3) }],
  });
  const ocean = k.status({
    id: "ode-to-ocean",
    origin: "memospriteSkill",
    modifiers: [{ stat: "dmgBoost", value: k.param("1141522", 1) }],
  });
  const flowingWarmth = k.status({
    id: "flowing-warmth",
    origin: "memospriteSkill",
  });
  const romance = k.status({ id: "romance", origin: "memospriteSkill" });
  const reasonPending = k.status({
    id: "ode-to-reason",
    origin: "memospriteSkill",
  });
  const knowledgeSource = k.status({
    id: "true-knowledge-source",
    origin: "memospriteSkill",
  });
  const trueKnowledge = k.status({
    id: "true-knowledge",
    origin: "memospriteSkill",
    modifiers: [
      { stat: "atkPct", value: k.param("1141518", 3) },
      {
        stat: "dmgBoost",
        value: k.param("1141518", 2),
        filter: { tags: ["skill"] },
      },
    ],
  });
  const time = k.status({ id: "ode-to-time", origin: "memospriteSkill" });

  k.teamStat("talent", { stat: "dmgBoost", value: k.param("04", 2) });
  if (k.a(3)) {
    k.teamStat("a6", {
      stat: "dmgBoost",
      scaling: {
        source: "applier",
        stat: "spd",
        atLeast: k.traceParam(3, 1),
        ratio: k.traceParam(3, 4),
      },
    });
    // Cyrene's permanent modifiers also reach Demiurge (shared panel).
    k.stat("a6", {
      stat: "resPen",
      filter: { combatTypes: ["Ice"] },
      scaling: {
        source: "holder",
        stat: "spd",
        threshold: k.traceParam(3, 1),
        ratio: k.traceParam(3, 2),
        cap: k.traceParam(3, 2) * k.traceParam(3, 3),
      },
    });
  }

  const findDemiurge = (ctx: BattleApi, owner: UnitView) =>
    ctx.findSummon(owner, DEMIURGE);

  const gainRecollection = (ctx: BattleApi, amount: number) =>
    ctx.addCounter(ctx.self, RECOLLECTION, amount, recollectionCap);

  // The Zone reaches every ally target, including later memosprites.
  const spreadZone = (ctx: BattleApi, cyrene: UnitView) => {
    if (!cyrene.has(zoneMarker)) return;
    const stacks = cyrene.counter(ODE_TARGETS);
    for (const ally of ctx.allies) {
      if (ally.kind === "summon") continue;
      if (!ally.has(zone)) ctx.applyStatus(ally, zone);
      if (k.e(2) && stacks > 0) {
        ctx.applyStatus(ally, zoneE2, { setStacks: stacks });
      }
    }
  };
  const removeZone = (ctx: BattleApi, cyrene: UnitView) => {
    ctx.removeStatus(cyrene, zoneMarker);
    for (const ally of ctx.allies) {
      ctx.removeStatus(ally, zone);
      ctx.removeStatus(ally, zoneE2);
    }
  };
  const deployZone = (ctx: BattleApi, cyrene: UnitView) => {
    ctx.applyStatus(cyrene, zoneMarker);
    ctx.setCounter(cyrene, ZONE_TURNS, k.param("02", 2));
    spreadZone(ctx, cyrene);
  };

  const grantFuture = (ctx: BattleApi, cyrene: UnitView) => {
    for (const ally of ctx.allies) {
      if (ally === cyrene || ally.kind === "summon") continue;
      if (ally.owner === cyrene) continue;
      ctx.applyStatus(ally, future);
    }
  };

  const gainStory = (ctx: BattleApi, cyrene: UnitView, demiurge: UnitView) => {
    ctx.addCounter(cyrene, STORY, 1);
    if (cyrene.counter(STORY) + 1e-9 < k.param("1141526", 2)) return;
    // Story is full: an extra turn that automatically uses Minuet.
    ctx.setCounter(cyrene, STORY, 0);
    ctx.addCounter(cyrene, AUTO_MINUET, 1);
    ctx.grantExtraTurn(demiurge);
  };

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    grantFuture(ctx, ctx.self);
    if (k.a(2)) {
      const heirs = k.team.filter(
        (member) =>
          member.characterId !== k.id &&
          (member.pathId === "Memory" || CHRYSOS_HEIRS.has(member.characterId))
      ).length;
      if (heirs > 0) gainRecollection(ctx, k.traceParam(2, Math.min(3, heirs)));
    }
    if (k.e(2)) gainRecollection(ctx, k.rankParam(2, 1));
  });

  // "After Cyrene takes action, other ally characters and their
  // memosprites gain Future."
  k.on("turnEnd", "talent", { subject: "self" }, (ctx) =>
    grantFuture(ctx, ctx.self)
  );

  // Allies with Future give 1 Recollection whenever they use an ability
  // (Ultimates and follow-ups included). With A2, teammates' memosprites
  // keep Future (they gain it when summoned).
  k.on(
    "actionStart",
    "talent",
    {
      subject: "otherAlly",
      when: (event, self) => {
        const unit = event.unit;
        if (unit.kind === "summon" || unit.owner === self) return false;
        return unit.has(future) || (k.a(1) && unit.kind === "memosprite");
      },
    },
    (ctx, event) => {
      const unit = event.unit;
      if (!(k.a(1) && unit.kind === "memosprite")) {
        ctx.removeStatus(unit, future);
      }
      gainRecollection(ctx, k.param("04", 1));
      // Ode to Ego counts each different teammate (memosprites included,
      // Demiurge excluded) that gave Recollection.
      if (ctx.self.counter(sourceKey(unit)) === 0) {
        ctx.setCounter(ctx.self, sourceKey(unit), 1);
        ctx.setCounter(ctx.self, SOURCES, ctx.self.counter(SOURCES) + 1);
      }
    }
  );

  // "The Zone's duration decreases by 1 at the start of Cyrene's every turn."
  k.on(
    "turnStart",
    "skill",
    {
      subject: "self",
      when: (_event, self) => self.has(zoneMarker) && !self.has(ripples),
    },
    (ctx) => {
      ctx.addCounter(ctx.self, ZONE_TURNS, -1);
      if (ctx.self.counter(ZONE_TURNS) <= 1e-9) removeZone(ctx, ctx.self);
    }
  );

  // Memosprites summoned later enter the Zone; Ode to Genesis also applies
  // to Mem whenever it is summoned.
  k.on(
    "summoned",
    "skill",
    { subject: "ally", when: (event) => event.unit.kind === "memosprite" },
    (ctx, event) => {
      spreadZone(ctx, ctx.self);
      if (event.unit.owner?.has(genesis)) {
        ctx.applyStatus(event.unit, genesis);
      }
    }
  );

  // Ode effects that trigger on the buffed ally's actions.
  k.on(
    "actionEnd",
    "memospriteSkill",
    {
      subject: "ally",
      attack: true,
      when: (event) =>
        event.unit.has(flowingWarmth) ||
        event.unit.has(romance) ||
        (event.unit.owner?.has(romance) ?? false),
    },
    (ctx, event) => {
      const unit = event.unit.owner?.has(romance)
        ? event.unit.owner
        : event.unit;
      if (unit.has(flowingWarmth)) {
        ctx.removeStatus(unit, flowingWarmth);
        ctx.gainEnergy(unit, k.param("1141522", 4));
      }
      if (unit.has(romance)) {
        ctx.removeStatus(unit, romance);
        ctx.gainEnergy(unit, k.param("1141514", 1));
      }
    }
  );
  // Ode to Ocean: Basic ATK/Skill attacks detonate the targets' DoTs.
  k.on(
    "actionEnd",
    "memospriteSkill",
    {
      subject: "ally",
      attack: true,
      abilityKinds: ["basic", "skill"],
      when: (event) => event.unit.has(ocean),
    },
    (ctx, event) => {
      const ratio =
        event.abilityKind === "basic"
          ? k.param("1141522", 2)
          : k.param("1141522", 3);
      for (const enemy of event.targetsHit ?? []) {
        if (isEnemy(enemy)) ctx.detonateDots(enemy, ratio);
      }
    }
  );
  // Ode to Reason: True Knowledge from Anaxa's next Basic ATK or Skill
  // until the start of his next turn.
  k.on(
    "actionStart",
    "memospriteSkill",
    {
      subject: "ally",
      abilityKinds: ["basic", "skill"],
      when: (event) => event.unit.has(reasonPending),
    },
    (ctx, event) => {
      ctx.removeStatus(event.unit, reasonPending);
      ctx.applyStatus(event.unit, knowledgeSource);
      for (const ally of ctx.allies) {
        if (ally.kind === "character" && ally.pathId === "Mage") {
          ctx.applyStatus(ally, trueKnowledge);
        }
      }
    }
  );
  k.on(
    "turnStart",
    "memospriteSkill",
    { subject: "ally", when: (event) => event.unit.has(knowledgeSource) },
    (ctx, event) => {
      ctx.removeStatus(event.unit, knowledgeSource);
      for (const ally of ctx.allies) ctx.removeStatus(ally, trueKnowledge);
    }
  );
  // Ode to Time: +1 Memoria (Evernight's counter) after her Skill/Ultimate.
  k.on(
    "actionEnd",
    "memospriteSkill",
    {
      subject: "ally",
      abilityKinds: ["skill", "ultimate"],
      when: (event) => event.unit.has(time),
    },
    (ctx, event) => ctx.addCounter(event.unit, "memoria", k.param("1141524", 2))
  );

  k.ability({
    id: "basic",
    kind: "basic",
    energy: 0,
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        stat: "hp",
        toughness: { main: 10 },
      },
    ],
    before: (ctx) => gainRecollection(ctx, k.param("01", 2)),
  });

  // "To Love and Tomorrow ♪" cannot recover Skill Points.
  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    energy: 0,
    skillPoints: 0,
    hits: [
      {
        shape: "single",
        main: k.param("08", 3),
        stat: "hp",
        toughness: { main: 10 },
      },
      {
        shape: "aoe",
        each: k.param("08", 1),
        stat: "hp",
        toughness: { main: 0, each: 5 },
      },
    ],
    before: (ctx) => gainRecollection(ctx, k.param("08", 2)),
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "none",
    energy: 0,
    before: (ctx) => {
      gainRecollection(ctx, k.param("02", 3));
      deployZone(ctx, ctx.self);
    },
  });

  // Recollection is Cyrene's Ultimate resource (max Energy 24 in data):
  // the first Ultimate at 24 points, "Reunion at First Sight" at 12 in
  // Ripples. Facts list 12 as both costs; the first Ultimate is modeled as
  // spending its activation threshold of 24 (see tracker).
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "none",
    energy: 0,
    resource: { counter: RECOLLECTION, amount: k.param("04", 4) },
    usable: (view) => !view.self.has(ripples),
    before: (ctx) => {
      const cyrene = ctx.self;
      const demiurge = ctx.summon(cyrene, DEMIURGE);
      // "SPD remains at 0, and it will not appear on the Action Order."
      ctx.setInActionOrder(demiurge, false);
      ctx.applyStatus(cyrene, waiting);
      ctx.applyStatus(demiurge, waiting);
      ctx.grantExtraTurn(demiurge);
      // "Activates all teammates' Ultimate": their Energy is filled.
      for (const ally of ctx.allies) {
        if (ally.kind === "character" && ally !== cyrene) {
          ctx.setEnergy(ally, ally.maxEnergy);
        }
      }
      ctx.applyStatus(cyrene, ripples);
      ctx.applyStatus(cyrene, ripplesCrit);
      ctx.applyStatus(demiurge, ripplesCrit);
      deployZone(ctx, cyrene);
      // Ode to Ego: Story when Demiurge is summoned and after the Ultimate.
      gainStory(ctx, cyrene, demiurge);
      gainStory(ctx, cyrene, demiurge);
      if (k.e(6)) {
        for (const ally of ctx.allies) {
          if (ally !== demiurge) ctx.advanceAction(ally, k.rankParam(6, 1));
        }
      }
    },
  });

  k.ability({
    id: "reunion",
    kind: "ultimate",
    target: "none",
    energy: 0,
    resource: { counter: RECOLLECTION, amount: k.param("04", 5) },
    usable: (view) => view.self.has(ripples),
    before: (ctx) => {
      const demiurge = findDemiurge(ctx, ctx.self);
      if (!demiurge) return;
      ctx.grantExtraTurn(demiurge);
      gainStory(ctx, ctx.self, demiurge);
    },
  });

  // The Ode goes to the user's choice, by default the damage dealer: a
  // Chrysos Heir outside the support Paths first, then any teammate outside
  // them, then the first one.
  const dealer = (characterId: string, pathId: string) =>
    !SUPPORT_PATHS.has(pathId) && !SUPPORT_IDS.has(characterId);
  const odeMember = k.ally(
    "ode-to-all-lives",
    "memospriteSkill",
    (candidates) =>
      candidates.find(
        (member) =>
          dealer(member.characterId, member.pathId) &&
          CHRYSOS_HEIRS.has(member.characterId)
      ) ??
      candidates.find((member) => dealer(member.characterId, member.pathId))
  );
  const odeTarget = (view: PolicyView): UnitView | null =>
    odeMember
      ? (view.allies.find(
          (ally) => ally.kind === "character" && ally.slot === odeMember.slot
        ) ?? null)
      : null;

  const egoBase = k.param("1141526", 1);
  const minuetHits = (ctx: BattleApi): HitDef[] => {
    const cyrene = ctx.self.owner;
    const hits: HitDef[] = [
      {
        shape: "aoe",
        each: demiurgeHp * k.param("1141501", 1),
        stat: "hp",
        toughness: { each: 10 },
      },
    ];
    const sources = cyrene?.counter(SOURCES) ?? 0;
    if (!cyrene || sources <= 0) return hits;
    const stacks = k.e(4)
      ? Math.min(k.rankParam(4, 2), cyrene.counter(MINUET_USES))
      : 0;
    // Ode to Ego: one random-target instance per teammate. Facts list a
    // 1.67 Toughness value besides the AoE's 10; it is assumed to be per
    // instance, like Mem's Bounce instances.
    hits.push({
      shape: "bounce",
      each: demiurgeHp * (egoBase + stacks * (k.e(4) ? k.rankParam(4, 1) : 0)),
      bounces: sources + (k.e(1) ? k.rankParam(1, 2) : 0),
      stat: "hp",
      toughness: { each: 5 / 3 },
    });
    return hits;
  };

  const applyOde = (ctx: BattleApi, target: UnitView) => {
    const cyrene = ctx.self.owner;
    if (!cyrene) return;
    const id = canonicalCharacterId(target.definitionId);
    const withMemosprites = (status: typeof odeDmg) => {
      ctx.applyStatus(target, status);
      for (const ally of ctx.allies) {
        if (ally.owner === target) ctx.applyStatus(ally, status);
      }
    };
    switch (id) {
      case "8007":
        withMemosprites(genesis);
        break;
      case "1403":
        ctx.applyStatus(target, passage);
        break;
      case "1406": {
        ctx.applyStatus(target, trickery);
        const patron = ctx.mainTarget;
        for (const enemy of ctx.enemies) {
          ctx.applyStatus(
            enemy,
            enemy === patron ? trickeryPatron : trickeryOthers
          );
        }
        break;
      }
      case "1410":
        ctx.applyStatus(target, ocean);
        ctx.applyStatus(target, flowingWarmth);
        break;
      case "1402":
        ctx.applyStatus(target, romance);
        break;
      case "1405":
        ctx.gainSkillPoints(k.param("1141518", 4));
        ctx.advanceAction(target, 1);
        ctx.applyStatus(target, reasonPending);
        break;
      case "1409":
        ctx.gainEnergy(target, k.param("1141519", 2));
        break;
      case "1413":
        ctx.applyStatus(target, time);
        break;
      default:
        if (!CHRYSOS_HEIRS.has(id)) withMemosprites(odeDmg);
    }
    if (cyrene.counter(odeKey(target)) === 0) {
      ctx.setCounter(cyrene, odeKey(target), 1);
      ctx.setCounter(cyrene, ODE_TARGETS, cyrene.counter(ODE_TARGETS) + 1);
      spreadZone(ctx, cyrene);
    }
  };

  k.memosprite({
    servantId: DEMIURGE,
    speed: { flat: 0 },
    // Demiurge acts only on extra turns: Story turns use Minuet, the first
    // other turn gives the Ode to the damage dealer, then Minuet.
    policy: (view) => {
      const cyrene = view.self.owner;
      if (!cyrene || cyrene.counter(AUTO_MINUET) > 1e-9) return "minuet";
      if (cyrene.counter(ODE_USED) > 0) return "minuet";
      const target = odeTarget(view);
      return target ? { ability: "ode", target } : "minuet";
    },
    abilities: [
      {
        id: "minuet",
        kind: "memospriteSkill",
        hits: (ctx) => minuetHits(ctx),
        after: (ctx) => {
          const cyrene = ctx.self.owner;
          if (!cyrene) return;
          if (cyrene.counter(AUTO_MINUET) > 1e-9) {
            ctx.addCounter(cyrene, AUTO_MINUET, -1);
          }
          if (k.e(4)) ctx.addCounter(cyrene, MINUET_USES, 1);
          if (cyrene.counter(SOURCES) <= 0) return;
          // Ode to Ego triggered during Minuet.
          if (k.e(1)) {
            ctx.addCounter(
              cyrene,
              RECOLLECTION,
              k.rankParam(1, 1),
              recollectionCap
            );
          }
          if (k.e(6)) {
            ctx.addCounter(cyrene, EGO_TRIGGERS, 1);
            if (cyrene.counter(EGO_TRIGGERS) < 2 - 1e-9) {
              for (const enemy of ctx.enemies) ctx.applyStatus(enemy, e6Def);
            } else {
              for (const ally of ctx.allies) {
                if (ally !== ctx.self)
                  ctx.advanceAction(ally, k.rankParam(6, 3));
              }
            }
          }
        },
      },
      {
        id: "ode",
        kind: "memospriteSkill",
        target: "ally",
        before: (ctx) => {
          const cyrene = ctx.self.owner;
          const target = ctx.target;
          if (!cyrene || !target || isEnemy(target)) return;
          ctx.setCounter(cyrene, ODE_USED, 1);
          applyOde(ctx, target);
        },
      },
    ],
  });

  // Skill to keep the Zone up, Basic ATK otherwise; only the Enhanced
  // Basic ATK during Ripples. The Ultimate is cast as soon as possible.
  k.policy({
    turn: (view) => {
      if (view.self.has(ripples)) return "enhancedBasic";
      return !view.self.has(zoneMarker) && view.skillPoints >= 1
        ? "skill"
        : "basic";
    },
    ultimate: (view) => (view.self.has(ripples) ? "reunion" : true),
  });
});
