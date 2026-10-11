import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const DAMAGE_PATHS = ["Mage", "Warrior", "Rogue", "Memory", "Elation"];

/**
 * Single-ally Skill target: the first teammate on a damage Path (Erudition,
 * Destruction, The Hunt, Remembrance, Elation), else Nihility, else any.
 */
function carry(view: {
  self: UnitView;
  allies: readonly UnitView[];
}): UnitView {
  const others = view.allies.filter(
    (ally) => ally.kind === "character" && ally !== view.self
  );
  return (
    others.find((ally) => DAMAGE_PATHS.includes(ally.pathId)) ??
    others.find((ally) => ally.pathId === "Warlock") ??
    others[0] ??
    view.self
  );
}

/** Sparkle — Harmony, Quantum. */
export default defineCharacter("1306", (k) => {
  const dreamdiver = k.status({
    id: "dreamdiver",
    origin: "skill",
    // A4 extends "1 turn" until the start of the target's next turn: the
    // turn after the Skill counts, and the following turn start removes it.
    duration: k.a(2)
      ? { turns: k.param("02", 3) + 1, countdown: "turnStart" }
      : { turns: k.param("02", 3) },
    modifiers: [
      {
        stat: "critDmg",
        value: k.param("02", 2),
        scaling: {
          source: "applier",
          stat: "critDmg",
          ratio: k.param("02", 1) + (k.e(6) ? k.rankParam(6, 1) : 0),
        },
      },
    ],
  });

  const talentModifiers: ModifierDef[] = [
    { stat: "dmgBoost", value: k.param("04", 2) },
  ];
  if (k.e(2)) {
    talentModifiers.push({ stat: "defIgnore", value: k.rankParam(2, 1) });
  }
  const redHerring = k.status({
    id: "red-herring",
    origin: "talent",
    duration: { turns: k.param("04", 1) },
    maxStacks: k.param("04", 4),
    modifiers: talentModifiers,
  });

  const cipher = k.status({
    id: "cipher",
    origin: "ultimate",
    // E1: "lasts for 1 extra turn".
    duration: { turns: k.param("03", 4) + (k.e(1) ? 1 : 0) },
    modifiers: k.e(1) ? [{ stat: "atkPct", value: k.rankParam(1, 1) }] : [],
  });
  // Cipher raises every Talent stack: this companion mirrors the Talent's
  // stacks on allies holding Cipher.
  const cipherStacks = k.status({
    id: "cipher-red-herring",
    origin: "ultimate",
    maxStacks: k.param("04", 4),
    modifiers: [{ stat: "dmgBoost", value: k.param("03", 3) }],
  });

  const syncCipher = (ctx: BattleApi) => {
    for (const ally of ctx.allies) {
      const stacks = ally.has(cipher) ? ally.stacks(redHerring) : 0;
      if (stacks <= 0) ctx.removeStatus(ally, cipherStacks);
      else if (ally.has(cipherStacks)) {
        ctx.setStatusStacks(ally, cipherStacks, stacks);
      } else ctx.applyStatus(ally, cipherStacks, { setStacks: stacks });
    }
  };
  // Talent stacks and Cipher expire on their holders' turns: resync before
  // every turn (DoTs tick at enemy turn starts) and every action.
  k.on("turnStart", "ultimate", { subject: "any" }, (ctx) => syncCipher(ctx));
  k.on("actionStart", "ultimate", { subject: "any" }, (ctx) => syncCipher(ctx));

  const teammatesWithCipher = (ctx: BattleApi) =>
    ctx.allies.filter((ally) => ally !== ctx.self && ally.has(cipher));

  // E4: "additionally increases the Max Skill Points by 1".
  const extraSkillPoints = k.param("04", 3) + (k.e(4) ? 1 : 0);
  k.on("battleStart", "talent", { subject: "any" }, (ctx) =>
    ctx.setMaxSkillPoints(ctx.maxSkillPoints + extraSkillPoints)
  );
  k.on(
    "skillPointsChanged",
    "talent",
    { subject: "ally", when: (event) => (event.delta ?? 0) < 0 },
    (ctx, event) => {
      const stacks = -(event.delta ?? 0);
      for (const ally of ctx.allies) {
        ctx.applyStatus(ally, redHerring, { stacks });
      }
      syncCipher(ctx);
    }
  );

  if (k.a(3)) {
    k.teamStat("a6", { stat: "atkPct", value: k.traceParam(3, 4) });
    const quantum = Math.min(3, k.countCombatType("Quantum"));
    if (quantum > 0) {
      k.teamStat(
        "a6",
        { stat: "atkPct", value: k.traceParam(3, quantum) },
        "allies",
        { combatTypes: ["Quantum"] }
      );
    }
  }

  k.ability({
    id: "basic",
    kind: "basic",
    energy: 20 + (k.a(1) ? k.traceParam(1, 1) : 0),
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    before: (ctx) => {
      const target = ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;
      ctx.applyStatus(target, dreamdiver);
      if (k.e(6)) {
        for (const ally of teammatesWithCipher(ctx)) {
          ctx.applyStatus(ally, dreamdiver);
        }
      }
      if (target !== ctx.self) ctx.advanceAction(target, k.param("02", 4));
    },
  });

  // E4: "The Ultimate recovers 1 more Skill Point".
  const ultimateSkillPoints = k.param("03", 2) + (k.e(4) ? 1 : 0);
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      ctx.gainSkillPoints(ultimateSkillPoints);
      for (const ally of ctx.allies) ctx.applyStatus(ally, cipher);
      if (k.e(6) && ctx.allies.some((ally) => ally.has(dreamdiver))) {
        for (const ally of teammatesWithCipher(ctx)) {
          if (!ally.has(dreamdiver)) ctx.applyStatus(ally, dreamdiver);
        }
      }
      syncCipher(ctx);
    },
  });

  k.policy({
    // Skill on the carry whenever a Skill Point is available.
    turn: (view) =>
      view.skillPoints >= 1
        ? { ability: "skill", target: carry(view) }
        : "basic",
  });
});
