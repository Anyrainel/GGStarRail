import {
  type BattleApi,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const HIT_THIS_ATTACK = "dahlia:hit";
const FOLLOW_UP_THIS_TURN = "dahlia:follow-up";
const FOLLOW_UPS = "dahlia:follow-ups";
const E1_TRIGGERED = "dahlia:e1";
const ATTACKER_SLOT = "dahlia:a6-attacker";
const IMPLANTED = "dahlia:a6-implanted";

/** The Dahlia — Nihility, Fire. */
export default defineCharacter("1321", (k) => {
  // Talent: Dance Partners convert Toughness Reduction against Weakness
  // Broken enemies into Super Break DMG at #5. E1 adds #4 for them (read as
  // percentage points) and gives every ally character the base #5.
  const partnerConversion = k.param("04", 5) + (k.e(1) ? k.rankParam(1, 4) : 0);
  // The Dahlia is always a Dance Partner, so her share is permanent.
  k.stat("talent", { stat: "superBreakDmg", value: partnerConversion });
  if (k.e(6)) k.stat("e6", { stat: "breakEffect", value: k.rankParam(6, 1) });
  const partnerModifiers: ModifierDef[] = [
    { stat: "superBreakDmg", value: partnerConversion },
  ];
  if (k.e(6)) {
    partnerModifiers.push({ stat: "breakEffect", value: k.rankParam(6, 1) });
  }
  const dancePartner = k.status({
    id: "dance-partner",
    origin: "talent",
    modifiers: partnerModifiers,
  });
  const e1Conversion = k.e(1)
    ? k.status({
        id: "bud-readies-to-bloom",
        origin: "e1",
        modifiers: [{ stat: "superBreakDmg", value: k.param("04", 5) }],
      })
    : null;
  // Each Talent Follow-Up instance against a Weakness Broken enemy converts
  // its own Toughness Reduction at #3.
  k.stat("talent", {
    stat: "superBreakDmg",
    value: k.param("04", 3),
    filter: { tags: ["followUp"] },
  });

  const isPartner = (ctx: BattleApi, unit: UnitView) =>
    unit === ctx.self || unit.has(dancePartner);

  // Skill Zone. Its conversion of Toughness Reduction against enemies that
  // are not Weakness Broken has no Engine support and is not modeled.
  const zoneDuration = {
    turns: k.param("02", 2),
    countdown: "turnStart" as const,
    clock: "applier" as const,
  };
  const zone = k.status({
    id: "zone",
    origin: "skill",
    duration: zoneDuration,
  });
  const zoneEfficiency = k.status({
    id: "zone-break-efficiency",
    origin: "skill",
    duration: zoneDuration,
    modifiers: [{ stat: "breakEfficiency", value: k.param("02", 3) }],
  });

  const wilt = k.status({
    id: "wilt",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 2) },
    modifiers: [{ stat: "defReduction", value: k.param("03", 3) }],
  });

  // Each grant sets its own duration (#2 at battle start, #4 on healing).
  const funeral = k.status({
    id: "yet-another-funeral",
    origin: "a2",
    duration: { turns: k.traceParam(1, 2) },
    modifiers: [
      {
        stat: "breakEffect",
        value: k.traceParam(1, 3),
        scaling: {
          source: "applier",
          stat: "breakEffect",
          ratio: k.traceParam(1, 1),
        },
      },
    ],
  });
  const grantFuneral = (ctx: BattleApi, turns: number) => {
    for (const ally of ctx.allies) {
      if (ally.kind === "character" && ally !== ctx.self) {
        ctx.applyStatus(ally, funeral, { turns });
      }
    }
  };

  const outgrowSpd = k.status({
    id: "outgrow-the-old",
    origin: "a6",
    duration: { turns: k.traceParam(3, 4) },
    modifiers: [{ stat: "spdPct", value: k.traceParam(3, 3) }],
  });
  // E2's Wilt on enemies entering the field needs enemy waves (not modeled).
  const e2Res = k.e(2)
    ? k.status({
        id: "fresh-ethereal",
        origin: "e2",
        modifiers: [{ stat: "resReduction", value: k.rankParam(2, 1) }],
      })
    : null;
  const e4Vulnerability = k.status({
    id: "heart-gnawed",
    origin: "e4",
    debuff: true,
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "vulnerability", value: k.rankParam(4, 1) }],
  });

  // The Dance Partner is the teammate that triggered combat, the player's
  // choice; by default the first teammate not on a support Path (the Break
  // DPS), then team order.
  const supportPaths = new Set(["Shaman", "Priest", "Knight"]);
  const partnerMember = k.ally(
    "dance-partner",
    "talent",
    (candidates) =>
      candidates.find((member) => !supportPaths.has(member.pathId)) ??
      candidates[0]
  );

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.param("04", 4));
    const partner = ctx.allies.find(
      (ally) => ally.kind === "character" && ally.slot === partnerMember?.slot
    );
    if (partner) ctx.applyStatus(partner, dancePartner);
    if (e1Conversion) {
      for (const ally of ctx.allies) {
        if (ally.kind === "character" && !isPartner(ctx, ally)) {
          ctx.applyStatus(ally, e1Conversion);
        }
      }
    }
    if (k.a(1)) grantFuneral(ctx, k.traceParam(1, 2));
    if (e2Res) {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, e2Res);
    }
  });

  if (k.a(1)) {
    // Retriggers when a teammate heals The Dahlia (Shields are not modeled).
    k.on(
      "hpChanged",
      "a2",
      {
        subject: "self",
        when: (event, self) =>
          event.hpCause === "heal" &&
          event.source !== undefined &&
          event.source !== self,
        limitPerTurn: 1,
      },
      (ctx) => grantFuneral(ctx, k.traceParam(1, 4))
    );
  }

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
    before: (ctx) => {
      ctx.applyStatus(ctx.self, zone);
      for (const ally of ctx.allies) ctx.applyStatus(ally, zoneEfficiency);
    },
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1),
        adjacent: k.param("02", 1),
        toughness: { main: 10, adjacent: 10 },
      },
    ],
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      const partnerTypes = ctx.allies
        .filter((ally) => isPartner(ctx, ally))
        .map((ally) => ally.combatType);
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, wilt);
        // The Weakness lasts as long as Wilt (both end on the enemy's turn).
        for (const type of partnerTypes) {
          ctx.implantWeakness(enemy, type, { turns: k.param("03", 2) });
        }
      }
    },
    hits: [{ shape: "split", main: k.param("03", 1), toughness: { each: 20 } }],
  });

  if (k.a(3)) {
    // The ally that adds a Weakness gains SPD. Weaknesses a Fire ally
    // character adds during its own attack mark their enemies for the fixed
    // Toughness Reduction and Energy after that attack.
    k.on("actionStart", "a6", { subject: "ally", attack: true }, (ctx, event) =>
      ctx.setCounter(ctx.self, ATTACKER_SLOT, event.unit.slot + 1)
    );
    k.on("weaknessImplanted", "a6", { subject: "ally" }, (ctx, event) => {
      ctx.applyStatus(event.unit, outgrowSpd);
      const duringOwnAttack =
        ctx.self.counter(ATTACKER_SLOT) === event.unit.slot + 1;
      if (
        isEnemy(event.target) &&
        event.unit.kind === "character" &&
        event.unit.combatType === "Fire" &&
        duringOwnAttack
      ) {
        ctx.setCounter(event.target, IMPLANTED, 1);
      }
    });
    k.on("actionEnd", "a6", { subject: "ally" }, (ctx) => {
      ctx.setCounter(ctx.self, ATTACKER_SLOT, 0);
      const marked = ctx.enemies.filter(
        (enemy) => enemy.counter(IMPLANTED) > 0
      );
      if (marked.length === 0) return;
      for (const enemy of marked) {
        ctx.setCounter(enemy, IMPLANTED, 0);
        ctx.reduceToughness(enemy, k.traceParam(3, 5), { fixed: true });
      }
      const cap = ctx.self.maxEnergy * k.traceParam(3, 1);
      if (ctx.self.energy < cap) {
        ctx.gainEnergy(ctx.self, ctx.self.maxEnergy * k.traceParam(3, 2));
        if (ctx.self.energy > cap) ctx.setEnergy(ctx.self, cap);
      }
    });
  }

  // Facts list 3 Toughness per Bounce instance.
  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 2,
    before: (ctx) => {
      if (k.a(2)) {
        // "For every 2 instance(s) of Talent's Follow-Up ATK used, this
        // effect can trigger once": the 1st, 3rd, 5th, ...
        if (ctx.self.counter(FOLLOW_UPS) % k.traceParam(2, 1) === 0) {
          ctx.gainSkillPoints(1);
        }
        ctx.setCounter(ctx.self, FOLLOW_UPS, ctx.self.counter(FOLLOW_UPS) + 1);
      }
      if (k.e(4)) {
        for (const enemy of ctx.enemies) {
          ctx.applyStatus(enemy, e4Vulnerability);
        }
      }
      if (k.e(6)) {
        for (const ally of ctx.allies) {
          if (isPartner(ctx, ally)) {
            ctx.advanceAction(ally, k.rankParam(6, 2));
          }
        }
      }
    },
    hits: [
      {
        shape: "bounce",
        bounces: k.param("04", 2) + (k.e(4) ? k.rankParam(4, 3) : 0),
        each: k.param("04", 1),
        toughness: { each: 3 },
      },
    ],
  });

  // E1: once per enemy (kills are not simulated), fixed Toughness Reduction
  // of #1 of its Max Toughness, clamped to [#2, #3].
  const e1Toughness = (ctx: BattleApi, enemy: EnemyView) => {
    if (enemy.counter(E1_TRIGGERED) > 0) return;
    ctx.setCounter(enemy, E1_TRIGGERED, 1);
    const amount = Math.min(
      k.rankParam(1, 3),
      Math.max(k.rankParam(1, 2), enemy.maxToughness * k.rankParam(1, 1))
    );
    ctx.reduceToughness(enemy, amount, { fixed: true });
  };

  // Enemies hit by the current attack, for the Talent and E1.
  k.on("actionStart", "talent", { subject: "ally" }, (ctx) => {
    for (const enemy of ctx.enemies) ctx.setCounter(enemy, HIT_THIS_ATTACK, 0);
  });
  k.on("hit", "talent", { subject: "ally" }, (ctx, event) => {
    if (isEnemy(event.target) && !event.tags?.includes("dot")) {
      ctx.setCounter(event.target, HIT_THIS_ATTACK, 1);
    }
  });
  // "This effect can only trigger once per turn."
  k.on("turnStart", "talent", { subject: "any" }, (ctx) =>
    ctx.setCounter(ctx.self, FOLLOW_UP_THIS_TURN, 0)
  );
  k.on(
    "actionEnd",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      if (!isPartner(ctx, event.unit)) return;
      const attacked = ctx.enemies.filter(
        (enemy) => enemy.counter(HIT_THIS_ATTACK) > 0
      );
      if (k.e(1)) {
        for (const enemy of attacked) e1Toughness(ctx, enemy);
      }
      if (
        event.unit === ctx.self ||
        attacked.length === 0 ||
        ctx.self.counter(FOLLOW_UP_THIS_TURN) > 0
      ) {
        return;
      }
      ctx.setCounter(ctx.self, FOLLOW_UP_THIS_TURN, 1);
      const target = isEnemy(event.target) ? event.target : attacked[0];
      ctx.queueAction(ctx.self, "followUp", { target });
    }
  );

  k.policy({
    // Skill to (re)deploy the Zone, Basic ATK while it lasts.
    turn: (view) =>
      !view.self.has(zone) && view.skillPoints >= 1 ? "skill" : "basic",
  });
});
