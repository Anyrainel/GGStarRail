import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const SUPPORT_PATHS = new Set(["Shaman", "Priest", "Knight"]);
// Kit-local IDs of stat-less summons that game text calls summons
// (Lightning-Lord, Numby, Fuyuan, Souldragon); countdowns such as Concerto
// are not. The engine cannot list an ally's summons (tracker
// sunday-summon-ids).
const SUMMON_IDS = ["lightning-lord", "numby", "fuyuan", "souldragon"];

/** The damage dealer: first ally Character in team order not on a support Path. */
function designate(
  self: UnitView,
  allies: readonly UnitView[]
): UnitView | null {
  const others = allies
    .filter((unit) => unit.kind === "character" && unit !== self)
    .sort((left, right) => left.slot - right.slot);
  return (
    others.find((unit) => !SUPPORT_PATHS.has(unit.pathId)) ?? others[0] ?? null
  );
}

/** Sunday — Harmony, Imaginary. */
export default defineCharacter("1313", (k) => {
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

  const summonsOf = (ctx: BattleApi, owner: UnitView): UnitView[] => {
    const result = ctx.allies.filter(
      (unit) => unit.kind === "memosprite" && unit.owner === owner
    );
    for (const id of SUMMON_IDS) {
      const summon = ctx.findSummon(owner, id);
      if (summon) result.push(summon);
    }
    return result;
  };
  const allyTarget = (ctx: BattleApi, chosen: UnitView | null) =>
    chosen && !isEnemy(chosen) && chosen.kind === "character"
      ? chosen
      : designate(ctx.self, ctx.allies);

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
      // Ultimates carry no ally target: the Skill's heuristic picks it.
      const target = designate(ctx.self, ctx.allies);
      if (!target) return;
      const energy = target.maxEnergy * k.param("03", 1);
      ctx.gainEnergy(
        target,
        k.a(1) ? Math.max(energy, k.traceParam(1, 1)) : energy
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
      const target = designate(view.self, view.allies);
      return target && view.skillPoints >= 1
        ? { ability: "skill", target }
        : "basic";
    },
  });
});
