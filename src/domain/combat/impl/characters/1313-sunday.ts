import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const SUPPORT_PATHS = new Set(["Shaman", "Priest", "Knight"]);

/** Sunday — Harmony, Imaginary. */
export default defineCharacter("1313", (k) => {
  // The teammate his Skill and Ultimate go to: by default the first in team
  // order not on a support Path.
  const beneficiary = k.ally(
    "beneficiary",
    "skill",
    (candidates) =>
      [...candidates]
        .sort((left, right) => left.slot - right.slot)
        .find((member) => !SUPPORT_PATHS.has(member.pathId)) ?? candidates[0]
  );
  const designate = (allies: readonly UnitView[]): UnitView | null =>
    allies.find(
      (unit) => unit.kind === "character" && unit.slot === beneficiary?.slot
    ) ?? null;

  // Summons other than countdowns, per owner, from summon events. Keyed by
  // the battle's units, so simulations share nothing.
  const activeSummons = new WeakMap<UnitView, UnitView[]>();
  const isSummon = (unit: UnitView) =>
    unit.kind === "summon" && !unit.countdown && unit.owner !== null;
  k.on(
    "summoned",
    "skill",
    { subject: "ally", when: (event) => isSummon(event.unit) },
    (_ctx, event) => {
      const owner = event.unit.owner;
      if (!owner) return;
      const list = activeSummons.get(owner) ?? [];
      if (!list.includes(event.unit)) list.push(event.unit);
      activeSummons.set(owner, list);
    }
  );
  k.on(
    "departed",
    "skill",
    { subject: "ally", when: (event) => isSummon(event.unit) },
    (_ctx, event) => {
      const owner = event.unit.owner;
      const list = owner ? activeSummons.get(owner) : undefined;
      if (owner && list) {
        activeSummons.set(
          owner,
          list.filter((unit) => unit !== event.unit)
        );
      }
    }
  );

  const benisonTurns = { turns: k.param("02", 3) };
  const benison = k.status({
    id: "benison",
    origin: "skill",
    duration: benisonTurns,
    modifiers: [{ stat: "dmgBoost", value: k.param("02", 2) }],
  });
  const benisonSummon = k.status({
    id: "benison-summon",
    origin: "skill",
    duration: benisonTurns,
    modifiers: [{ stat: "dmgBoost", value: k.param("02", 4) }],
  });

  const talentTurns = k.param("04", 2) + (k.e(6) ? k.rankParam(6, 3) : 0);
  const sorrowingBody = k.status({
    id: "sorrowing-body",
    origin: "talent",
    duration: { turns: talentTurns },
    maxStacks: k.e(6) ? k.rankParam(6, 1) : 1,
    modifiers: [{ stat: "critRate", value: k.param("04", 1) }],
  });
  // E6 overflow: a companion of the Talent buff so it does not scale with
  // the Talent's stacks.
  const cacophony = k.status({
    id: "sidereal-cacophony",
    origin: "e6",
    duration: { turns: talentTurns },
    modifiers: [
      {
        stat: "critDmg",
        scaling: {
          source: "holder",
          stat: "critRate",
          threshold: 1,
          step: 0.01,
          ratio: k.rankParam(6, 2),
        },
      },
    ],
  });

  // Summons attack with their owner's statuses, so the owner's copy carries
  // the summon value for them; memosprites receive their own copy.
  const quietus = k.status({
    id: "millennium-quietus",
    origin: "e1",
    duration: { turns: k.rankParam(1, 1) },
    modifiers: [
      {
        stat: "defIgnore",
        value: k.rankParam(1, 2),
        filter: { attackerKinds: ["character"] },
      },
      {
        stat: "defIgnore",
        value: k.rankParam(1, 3),
        filter: { attackerKinds: ["memosprite", "summon"] },
      },
    ],
  });

  const beatifiedModifiers: ModifierDef[] = [
    {
      stat: "critDmg",
      value: k.param("03", 4),
      scaling: {
        source: "applier",
        stat: "critDmg",
        ratio: k.param("03", 2),
      },
    },
  ];
  if (k.e(2)) {
    beatifiedModifiers.push({ stat: "dmgBoost", value: k.rankParam(2, 1) });
  }
  const beatified = k.status({
    id: "the-beatified",
    origin: "ultimate",
    duration: {
      turns: k.param("03", 3),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: beatifiedModifiers,
  });

  const summonsOf = (ctx: BattleApi, owner: UnitView): UnitView[] => [
    ...ctx.allies.filter(
      (unit) => unit.kind === "memosprite" && unit.owner === owner
    ),
    ...(activeSummons.get(owner) ?? []),
  ];
  const allyTarget = (ctx: BattleApi, chosen: UnitView | null) =>
    chosen && !isEnemy(chosen) && chosen.kind === "character"
      ? chosen
      : designate(ctx.allies);

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
    target: "ally",
    before: (ctx) => {
      const target = allyTarget(ctx, ctx.target);
      if (!target) return;
      const summons = summonsOf(ctx, target);
      const memosprites = summons.filter((unit) => unit.kind === "memosprite");
      for (const unit of [target, ...memosprites]) {
        ctx.applyStatus(unit, benison);
        if (summons.length > 0) ctx.applyStatus(unit, benisonSummon);
        else ctx.removeStatus(unit, benisonSummon);
        if (k.e(1)) ctx.applyStatus(unit, quietus);
      }
      ctx.applyStatus(target, sorrowingBody);
      if (k.e(6)) ctx.applyStatus(target, cacophony);
      if (target.pathId !== "Shaman") {
        for (const unit of [target, ...summons]) ctx.advanceAction(unit, 1);
      }
      // "Recovers 1 Skill Point" has no placeholder.
      if (target.has(beatified)) ctx.gainSkillPoints(1);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "ally",
    before: (ctx) => {
      const target = allyTarget(ctx, ctx.target);
      if (!target) return;
      // A fixed amount in game (FixedAddValue): ERR does not apply.
      const energy = target.maxEnergy * k.param("03", 1);
      ctx.gainEnergy(
        target,
        k.a(1) ? Math.max(energy, k.traceParam(1, 1)) : energy,
        { fixed: true }
      );
      for (const ally of ctx.allies) ctx.removeStatus(ally, beatified);
      const memosprites = summonsOf(ctx, target).filter(
        (unit) => unit.kind === "memosprite"
      );
      for (const unit of [target, ...memosprites]) {
        ctx.applyStatus(unit, beatified);
      }
      if (k.e(6)) {
        ctx.applyStatus(target, sorrowingBody);
        ctx.applyStatus(target, cacophony);
      }
    },
    after: (ctx) => {
      if (k.e(2) && ctx.self.counter("e2-first-ultimate") === 0) {
        ctx.setCounter(ctx.self, "e2-first-ultimate", 1);
        ctx.gainSkillPoints(k.rankParam(2, 2));
      }
    },
  });

  // The Beatified reaches the target's memosprites summoned while it lasts,
  // for its remaining duration.
  k.on(
    "summoned",
    "ultimate",
    {
      subject: "ally",
      when: (event) =>
        event.unit.kind === "memosprite" &&
        (event.unit.owner?.has(beatified) ?? false),
    },
    (ctx, event) => {
      const turns = event.unit.owner?.remainingTurns(beatified);
      if (turns) ctx.applyStatus(event.unit, beatified, { turns });
    }
  );

  if (k.a(2)) {
    k.on("battleStart", "a4", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(2, 1))
    );
  }
  if (k.e(4)) {
    k.on("turnStart", "e4", { subject: "self" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(4, 1))
    );
  }

  k.policy({
    // Skill the designated damage dealer whenever a Skill Point is available.
    turn: (view) => {
      const target = designate(view.allies);
      return target && view.skillPoints >= 1
        ? { ability: "skill", target }
        : "basic";
    },
    // The Ultimate goes to the same damage dealer.
    ultimate: (view) => {
      const target = designate(view.allies);
      return target ? { ability: "ultimate", target } : true;
    },
  });
});
