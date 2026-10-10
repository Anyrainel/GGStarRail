import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { AbilityKind, ModifierDef } from "../../kit/model";

const ATTACK_KINDS: readonly AbilityKind[] = [
  "basic",
  "skill",
  "ultimate",
  "followUp",
  "memospriteSkill",
  "elationSkill",
];

/** Fugue — Nihility, Fire. */
export default defineCharacter("1225", (k) => {
  // Not modeled (engine gaps): Toughness reduction against non-weak enemies
  // (Foxian Prayer at #6, the Ultimate in full) and Cloudflame Luster.
  const prayerModifiers: ModifierDef[] = [
    { stat: "breakEffect", value: k.param("02", 2) },
  ];
  if (k.e(1)) {
    prayerModifiers.push({
      stat: "breakEfficiency",
      value: k.rankParam(1, 1),
    });
  }
  if (k.e(4)) {
    prayerModifiers.push({
      stat: "dmgBoost",
      value: k.rankParam(4, 1),
      filter: { tags: ["break"] },
    });
  }
  // Foxian Prayer has no duration; it moves to the latest Skill target.
  const prayer = k.status({
    id: "foxian-prayer",
    origin: "skill",
    modifiers: prayerModifiers,
  });
  // Marks the designated target while E6 spreads Prayer to all allies.
  const designated = k.status({ id: "foxian-prayer-target", origin: "skill" });
  // Duration is tracked by a counter so E6 can end with it (see turnStart).
  const torridScorch = k.status({ id: "torrid-scorch", origin: "skill" });
  const defReduction = k.status({
    id: "foxian-prayer-def",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 5) },
    modifiers: [{ stat: "defReduction", value: k.param("02", 4) }],
  });

  k.teamStat("talent", { stat: "superBreakDmg", value: k.param("04", 1) });

  if (k.a(2)) k.stat("a4", { stat: "breakEffect", value: k.traceParam(2, 1) });
  if (k.e(6)) {
    k.stat("e6", { stat: "breakEfficiency", value: k.rankParam(6, 1) });
  }

  // The designated ally is the Break DPS: the ally Character with the
  // highest Break Effect, then a non-support Path, then team order.
  const supportPaths = new Set(["Shaman", "Priest", "Knight"]);
  const supportIds = new Set(
    k.team
      .filter((member) => supportPaths.has(member.pathId))
      .map((member) => member.characterId)
  );
  const better = (a: UnitView, b: UnitView) => {
    const diff = a.panelStat("breakEffect") - b.panelStat("breakEffect");
    if (Math.abs(diff) > 1e-9) return diff > 0;
    return supportIds.has(b.definitionId) && !supportIds.has(a.definitionId);
  };
  const prayerTarget = (ctx: BattleApi): UnitView => {
    let best: UnitView | null = null;
    for (const ally of ctx.allies) {
      if (ally.kind !== "character" || ally === ctx.self) continue;
      if (!best || better(ally, best)) best = ally;
    }
    return best ?? ctx.self;
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    hits: [
      {
        shape: "blast",
        main: k.param("08", 1),
        adjacent: k.param("08", 2),
        toughness: { main: 10, adjacent: 5 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    before: (ctx) => {
      const target = prayerTarget(ctx);
      for (const ally of ctx.allies) {
        if (ally === target) continue;
        ctx.removeStatus(ally, designated);
        ctx.removeStatus(ally, prayer);
      }
      ctx.applyStatus(target, designated);
      ctx.applyStatus(target, prayer);
      if (k.e(6)) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, prayer);
      }
      ctx.applyStatus(ctx.self, torridScorch);
      ctx.setCounter(ctx.self, "torrid-scorch", k.param("02", 1));
      if (k.a(2) && ctx.self.counter("a4-first-skill") === 0) {
        ctx.setCounter(ctx.self, "a4-first-skill", 1);
        ctx.gainSkillPoints(k.traceParam(2, 2));
      }
    },
  });

  // "The duration decreases by 1 at the start of Fugue's every turn."
  k.on("turnStart", "skill", { subject: "self" }, (ctx) => {
    if (!ctx.self.has(torridScorch)) return;
    ctx.addCounter(ctx.self, "torrid-scorch", -1);
    if (ctx.self.counter("torrid-scorch") > 0) return;
    ctx.removeStatus(ctx.self, torridScorch);
    if (k.e(6)) {
      for (const ally of ctx.allies) {
        if (!ally.has(designated)) ctx.removeStatus(ally, prayer);
      }
    }
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      if (k.e(2)) {
        for (const ally of ctx.allies) {
          ctx.advanceAction(ally, k.rankParam(2, 2));
        }
      }
    },
  });

  // DEF reduction on every enemy a Prayer holder attacks. The main target
  // gets it as the attack starts; other targets once they are hit.
  const shred = (ctx: BattleApi, attacker: UnitView, target?: UnitView) => {
    if (!attacker.has(prayer) || !isEnemy(target)) return;
    ctx.applyStatus(target, defReduction, { baseChance: k.param("02", 3) });
  };
  k.on(
    "actionStart",
    "skill",
    { subject: "ally", abilityKinds: ATTACK_KINDS, attack: true },
    (ctx, event) => shred(ctx, event.unit, event.target)
  );
  k.on(
    "hit",
    "skill",
    { subject: "ally", abilityKinds: ATTACK_KINDS },
    (ctx, event) => shred(ctx, event.unit, event.target)
  );

  // Teammates' Break Effect, plus #5 per stack while Fugue's own Break
  // Effect is at least #4.
  const phecda = k.status({
    id: "phecda-primordia",
    origin: "a6",
    duration: { turns: k.traceParam(3, 2) },
    maxStacks: k.traceParam(3, 3),
    modifiers: [
      { stat: "breakEffect", value: k.traceParam(3, 1) },
      {
        stat: "breakEffect",
        scaling: {
          source: "applier",
          stat: "breakEffect",
          atLeast: k.traceParam(3, 4),
          ratio: k.traceParam(3, 5),
        },
      },
    ],
  });

  if (k.a(1)) {
    k.on("weaknessBreak", "a2", { subject: "ally" }, (ctx, event) => {
      if (isEnemy(event.target)) {
        ctx.delayAction(event.target, k.traceParam(1, 1));
      }
    });
  }
  if (k.a(3)) {
    k.on("weaknessBreak", "a6", { subject: "ally" }, (ctx) => {
      for (const ally of ctx.allies) {
        if (ally !== ctx.self) ctx.applyStatus(ally, phecda);
      }
    });
  }
  if (k.e(2)) {
    k.on("weaknessBreak", "e2", { subject: "ally" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(2, 1))
    );
  }

  k.policy({
    // Skill to (re)enter Torrid Scorch, Enhanced Basic ATK while it lasts.
    turn: (view) =>
      view.self.has(torridScorch)
        ? "enhancedBasic"
        : view.skillPoints >= 1
          ? "skill"
          : "basic",
  });
});
