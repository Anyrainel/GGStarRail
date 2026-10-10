import { isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

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

/** Bronya — Harmony, Wind. */
export default defineCharacter("1101", (k) => {
  const redeployment = k.status({
    id: "combat-redeployment",
    origin: "skill",
    duration: {
      turns: k.param("02", 3) + (k.e(6) ? k.rankParam(6, 1) : 0),
    },
    modifiers: [{ stat: "dmgBoost", value: k.param("02", 1) }],
  });

  const belobogMarch = k.status({
    id: "belobog-march",
    origin: "ultimate",
    duration: { turns: k.param("03", 4) },
    modifiers: [
      { stat: "atkPct", value: k.param("03", 1) },
      {
        stat: "critDmg",
        value: k.param("03", 3),
        scaling: {
          source: "applier",
          stat: "critDmg",
          ratio: k.param("03", 2),
        },
      },
    ],
  });

  // E2 marks the Skill target; its SPD rises once it has taken action.
  const quickMarchPending = k.status({
    id: "quick-march-pending",
    origin: "e2",
  });
  const quickMarch = k.status({
    id: "quick-march",
    origin: "e2",
    duration: { turns: 1 },
    modifiers: [{ stat: "spdPct", value: k.rankParam(2, 1) }],
  });

  if (k.a(1)) {
    // "CRIT Rate for Basic ATK increases to 100%": the CRIT zone caps at 1.
    k.stat("a2", { stat: "critRate", value: 1, filter: { tags: ["basic"] } });
  }

  if (k.a(2)) {
    const battlefield = k.status({
      id: "battlefield",
      origin: "a4",
      duration: { turns: k.traceParam(2, 1) },
      modifiers: [{ stat: "defPct", value: k.traceParam(2, 2) }],
    });
    k.on("battleStart", "a4", { subject: "any" }, (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, battlefield);
    });
  }

  if (k.a(3)) {
    k.teamStat("a6", { stat: "dmgBoost", value: k.traceParam(3, 1) });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => ctx.advanceAction(ctx.self, k.param("04", 1)),
  });

  // E1 has a 1-turn cooldown: on a Skill it can only trigger if it did not
  // trigger on Bronya's previous turn (tracked as a probability).
  const E1_TRIGGERED = "e1-triggered";
  const E1_COOLDOWN = "e1-cooldown";
  if (k.e(1)) {
    k.on("turnStart", "e1", {}, (ctx) => {
      ctx.setCounter(ctx.self, E1_COOLDOWN, ctx.self.counter(E1_TRIGGERED));
      ctx.setCounter(ctx.self, E1_TRIGGERED, 0);
    });
  }

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    before: (ctx) => {
      const target = ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;
      ctx.applyStatus(target, redeployment);
      if (k.e(2)) ctx.applyStatus(target, quickMarchPending);
      if (target !== ctx.self) ctx.advanceAction(target, 1);
    },
    after: (ctx) => {
      if (!k.e(1)) return;
      const chance = k.rankParam(1, 1) * (1 - ctx.self.counter(E1_COOLDOWN));
      ctx.gainSkillPoints(chance);
      ctx.setCounter(ctx.self, E1_TRIGGERED, chance);
    },
  });

  if (k.e(2)) {
    k.on(
      "turnEnd",
      "e2",
      {
        subject: "ally",
        when: (event) => event.unit.has(quickMarchPending),
      },
      (ctx, event) => {
        ctx.removeStatus(event.unit, quickMarchPending);
        ctx.applyStatus(event.unit, quickMarch);
      }
    );
  }

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, belobogMarch);
    },
  });

  if (k.e(4)) {
    // The Talent's facts (Toughness 10, Energy 5) describe this Follow-Up
    // ATK. "80% of her Basic ATK DMG" scales the Basic ATK multiplier; the
    // hit is Follow-Up DMG only.
    k.ability({
      id: "followUp",
      kind: "followUp",
      energy: 5,
      hits: [
        {
          shape: "single",
          main: k.rankParam(4, 1) * k.param("01", 1),
          toughness: { main: 10 },
        },
      ],
    });
    k.on(
      "actionEnd",
      "e4",
      {
        subject: "otherAlly",
        abilityKinds: ["basic"],
        attack: true,
        when: (event) =>
          event.unit.kind === "character" &&
          isEnemy(event.target) &&
          event.target.weaknesses.has("Wind"),
        limitPerTurn: 1,
      },
      (ctx, event) => {
        if (!isEnemy(event.target)) return;
        ctx.queueAction(ctx.self, "followUp", { target: event.target });
      }
    );
  }

  k.policy({
    // Skill on the carry whenever a Skill Point is available.
    turn: (view) =>
      view.skillPoints >= 1
        ? { ability: "skill", target: carry(view) }
        : "basic",
  });
});
