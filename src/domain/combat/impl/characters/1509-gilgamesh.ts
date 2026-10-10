import type { BattleApi, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const SABER_ID = "1014";
const TALLY = "attack-tally";
const JOINT_QUEUED = "joint-queued";
/** Interest has no stated cap. */
const UNCAPPED = 999;

/** Gilgamesh — Destruction, Lightning. */
export default defineCharacter("1509", (k) => {
  // The tally and the Joint ATK need Saber (the ability config only launches
  // it while Saber is on the field).
  const withSaber = k.team.some((member) => member.characterId === SABER_ID);
  const interest = k.status({
    id: "interest",
    origin: "talent",
    maxStacks: UNCAPPED,
    modifiers: [{ stat: "spdPct", value: k.param("04", 4) }],
  });
  const piqued = k.status({ id: "interest-piqued", origin: "talent" });
  const hauteur = k.status({
    id: "heros-hauteur",
    origin: "a4",
    maxStacks: k.traceParam(2, 2),
    modifiers: [{ stat: "critDmg", value: k.traceParam(2, 1) }],
  });
  const kingsBurden = k.status({
    id: "kings-burden",
    origin: "talent",
    duration: { turns: k.param("04", 1) },
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.param("04", 3),
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  const acknowledgementModifiers: ModifierDef[] = [
    { stat: "defIgnore", value: k.param("02", 5) },
  ];
  if (k.e(1)) {
    acknowledgementModifiers.push({
      stat: "atkPct",
      value: k.rankParam(1, 1),
    });
  }
  const acknowledgement = k.status({
    id: "kings-acknowledgement",
    origin: "skill",
    duration: { turns: k.param("02", 6) },
    modifiers: acknowledgementModifiers,
  });
  // E1: the DEF ignore reaches teammates while Gilgamesh holds it; counting
  // down on his turns keeps both copies in step.
  const sharedAcknowledgement = k.status({
    id: "kings-acknowledgement-shared",
    origin: "e1",
    duration: { turns: k.param("02", 6), clock: "applier" },
    modifiers: [{ stat: "defIgnore", value: k.param("02", 5) }],
  });

  // Held between Ultimates; only his own Ultimate DMG reads it, and the
  // Ultimate consumes every point.
  const goldenRule = k.status({
    id: "golden-rule",
    origin: "e6",
    maxStacks: k.rankParam(6, 3),
    modifiers: [
      {
        stat: "critDmg",
        value: k.rankParam(6, 4),
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  // Joint ATK: "the next time she uses Ultimate, the DMG dealt becomes X%".
  const jointUltimate = k.status({
    id: "joint-ultimate-multiplier",
    origin: "talent",
    modifiers: [
      {
        stat: "dmgMultiplier",
        value: k.param("05", 6) - 1,
        filter: { tags: ["ultimate"] },
      },
    ],
  });

  // A6: "If the target's Max Energy exceeds 140, for every 1 excess point
  // ... up to 100%" on top of the flat part.
  const hegemonScaling = {
    source: "holder",
    stat: "maxEnergy",
    ratio: k.traceParam(3, 4),
    threshold: k.traceParam(3, 3),
    cap: k.traceParam(3, 5),
  } as const;
  if (k.a(3)) {
    k.teamStat("a6", {
      stat: "atkPct",
      value: k.traceParam(3, 1),
      scaling: hegemonScaling,
    });
    k.teamStat("a6", {
      stat: "critDmg",
      value: k.traceParam(3, 2),
      scaling: hegemonScaling,
    });
  }
  if (k.e(4)) k.stat("e4", { stat: "energyRegen", value: k.rankParam(4, 1) });
  if (k.e(6)) {
    // "Ally characters": memosprite hits are excluded, summon hits are the
    // Character's own.
    k.teamStat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 2),
      filter: { attackerKinds: ["character", "summon"] },
    });
  }

  const gainInterest = (ctx: BattleApi, amount: number) => {
    ctx.applyStatus(ctx.self, interest, { stacks: amount });
    if (k.a(2)) ctx.applyStatus(ctx.self, hauteur, { stacks: amount });
    if (
      !ctx.self.has(piqued) &&
      ctx.self.stacks(interest) >= k.param("04", 2)
    ) {
      ctx.applyStatus(ctx.self, piqued);
    }
  };

  const saberOf = (ctx: BattleApi): UnitView | undefined =>
    ctx.allies.find(
      (ally) => ally.kind === "character" && ally.definitionId === SABER_ID
    );

  if (k.e(2)) {
    k.on("battleStart", "e2", { subject: "any" }, (ctx) =>
      gainInterest(ctx, k.rankParam(2, 1))
    );
  }

  // "When another ally target takes action": turns of other allies and
  // memosprites; countdowns and other summons are not ally targets.
  k.on("turnStart", "talent", { subject: "otherAlly" }, (ctx, event) => {
    if (event.unit.kind === "summon") return;
    gainInterest(ctx, 1);
  });

  k.on(
    "actionStart",
    "talent",
    { subject: "otherAlly", abilityKinds: ["ultimate"] },
    (ctx, event) => {
      if (event.unit.kind !== "character") return;
      ctx.applyStatus(ctx.self, kingsBurden);
      if (k.a(1)) {
        gainInterest(ctx, k.traceParam(1, 1));
        const spent = event.energySpent ?? 0;
        if (spent > 0) {
          ctx.gainEnergy(ctx.self, spent * k.traceParam(1, 2), {
            fixed: true,
          });
        }
      }
      if (k.e(6)) ctx.applyStatus(ctx.self, goldenRule);
    }
  );

  // Talent 2: attacks by Gilgamesh or Saber fill the tally; the Joint ATK
  // follows the attack that reaches it.
  if (withSaber) {
    k.on(
      "actionEnd",
      "talent",
      {
        subject: "ally",
        attack: true,
        when: (event, self) =>
          event.unit === self
            ? event.abilityId !== "followUp"
            : event.unit.definitionId === SABER_ID,
      },
      (ctx) => {
        ctx.addCounter(ctx.self, TALLY, 1);
        if (
          ctx.self.counter(TALLY) >= k.param("05", 5) &&
          ctx.self.counter(JOINT_QUEUED) === 0
        ) {
          ctx.setCounter(ctx.self, JOINT_QUEUED, 1);
          ctx.queueAction(ctx.self, "followUp");
        }
      }
    );

    k.on(
      "actionEnd",
      "talent",
      {
        subject: "otherAlly",
        abilityKinds: ["ultimate"],
        when: (event) => event.unit.definitionId === SABER_ID,
      },
      (ctx, event) => ctx.removeStatus(event.unit, jointUltimate)
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // Facts (AvatarSkillConfigLD): the Skill costs no Skill Point.
  k.ability({
    id: "skill",
    kind: "skill",
    skillPoints: 0,
    hits: [
      {
        shape: "blast",
        main: k.param("02", 1) + (k.e(2) ? k.rankParam(2, 3) : 0),
        adjacent: k.param("02", 2) + (k.e(2) ? k.rankParam(2, 4) : 0),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    before: (ctx) => {
      ctx.applyStatus(ctx.self, acknowledgement);
      if (k.e(1)) {
        for (const ally of ctx.allies) {
          if (ally === ctx.self || ally.kind !== "character") continue;
          ctx.applyStatus(ally, sharedAcknowledgement);
        }
      }
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, interest);
      if (k.e(1)) ctx.gainEnergy(ctx.self, k.rankParam(1, 2), { fixed: true });
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      { shape: "aoe", each: k.param("03", 1), toughness: { each: 40 } },
      {
        shape: "bounce",
        each: k.param("03", 2) + (k.e(6) ? k.rankParam(6, 1) : 0),
        bounces: k.param("03", 3),
        toughness: { each: 2 },
      },
    ],
    before: (ctx) => {
      if (k.a(1)) gainInterest(ctx, k.traceParam(1, 3));
      if (k.e(2)) gainInterest(ctx, k.rankParam(2, 2));
    },
    after: (ctx) => {
      if (k.e(6)) ctx.removeStatus(ctx.self, goldenRule);
    },
  });

  // Joint Follow-Up ATK. Facts: 10 Energy, 20 AoE Toughness, all on
  // Gilgamesh's part (Saber's part has no StanceValue in the ability config).
  k.ability({
    id: "followUp",
    kind: "followUp",
    tags: ["followUp", "joint"],
    energy: 10,
    hits: [{ shape: "aoe", each: k.param("05", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      const saber = saberOf(ctx);
      if (saber) {
        ctx.deal(
          { shape: "aoe", each: k.param("05", 2) },
          {
            attacker: saber,
            tags: ["followUp", "joint"],
            abilityKind: "followUp",
            origin: "talent",
          }
        );
      }
      gainInterest(ctx, k.param("05", 3));
      if (saber) {
        // Saber's A4 keeps the overflow (her energyGained listener).
        ctx.gainEnergy(saber, k.param("05", 4), { fixed: true });
        ctx.applyStatus(saber, jointUltimate);
      }
      ctx.setCounter(ctx.self, TALLY, 0);
      ctx.setCounter(ctx.self, JOINT_QUEUED, 0);
    },
  });

  // Basic ATK is automatic until Interest first reaches the threshold; from
  // then on only the Skill can be used.
  k.policy({
    turn: (view) => (view.self.has(piqued) ? "skill" : "basic"),
  });
});
