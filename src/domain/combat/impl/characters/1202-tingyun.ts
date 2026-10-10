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

/** Tingyun — Harmony, Lightning. */
export default defineCharacter("1202", (k) => {
  const benedictionTurns = k.param("02", 3);
  // "ATK +50%, up to 25% of Tingyun's current ATK": the lower of the two
  // when the Skill is cast decides which form the ally receives.
  const benediction = k.status({
    id: "benediction",
    origin: "skill",
    duration: { turns: benedictionTurns },
    modifiers: [{ stat: "atkPct", value: k.param("02", 2) }],
  });
  const benedictionCapped = k.status({
    id: "benediction-capped",
    origin: "skill",
    duration: { turns: benedictionTurns },
    modifiers: [
      {
        stat: "atkFlat",
        scaling: { source: "applier", stat: "atk", ratio: k.param("02", 4) },
      },
    ],
  });
  const hasBenediction = (unit: UnitView) =>
    unit.has(benediction) || unit.has(benedictionCapped);
  const benedictionHolder = (allies: readonly UnitView[]) =>
    allies.find(hasBenediction) ?? null;
  // Turns the holder has taken since the last Skill, to recast in time.
  const HOLDER_TURNS = "benediction-turns";

  const rejoicingClouds = k.status({
    id: "rejoicing-clouds",
    origin: "ultimate",
    duration: { turns: k.param("03", 2) },
    modifiers: [{ stat: "dmgBoost", value: k.param("03", 3) }],
  });

  if (k.a(2)) {
    k.stat("a4", {
      stat: "dmgBoost",
      value: k.traceParam(2, 1),
      filter: { tags: ["basic"] },
    });
  }
  if (k.a(3)) {
    k.on("turnStart", "a6", {}, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(3, 1))
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  const nourishedJoviality = k.status({
    id: "nourished-joviality",
    origin: "a2",
    duration: { turns: 1 },
    modifiers: [{ stat: "spdPct", value: k.traceParam(1, 1) }],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    before: (ctx) => {
      const target =
        ctx.target && !isEnemy(ctx.target) ? ctx.target : carry(ctx);
      // "only effective on the most recent receiver of Tingyun's Skill".
      for (const ally of ctx.allies) {
        ctx.removeStatus(ally, benediction);
        ctx.removeStatus(ally, benedictionCapped);
      }
      const uncapped = k.param("02", 2) * target.panelStat("atkBase");
      const cap = k.param("02", 4) * ctx.self.panelStat("atk");
      ctx.applyStatus(
        target,
        uncapped <= cap ? benediction : benedictionCapped
      );
      ctx.setCounter(ctx.self, HOLDER_TURNS, 0);
      if (k.a(1)) ctx.applyStatus(ctx.self, nourishedJoviality);
    },
  });

  k.on(
    "turnEnd",
    "skill",
    { subject: "ally", when: (event) => hasBenediction(event.unit) },
    (ctx) => ctx.addCounter(ctx.self, HOLDER_TURNS, 1)
  );

  // The holder's attacks, including its summons' (counted as its own).
  const attackingHolder = (unit: UnitView) =>
    hasBenediction(unit)
      ? unit
      : unit.kind === "summon" && unit.owner && hasBenediction(unit.owner)
        ? unit.owner
        : null;

  const benedictionMultiplier =
    k.param("02", 1) + (k.e(4) ? k.rankParam(4, 1) : 0);
  k.on(
    "actionEnd",
    "skill",
    {
      subject: "ally",
      attack: true,
      when: (event) => attackingHolder(event.unit) !== null,
    },
    (ctx, event) => {
      const holder = attackingHolder(event.unit);
      const target = isEnemy(event.target)
        ? event.target
        : event.targetsHit?.[0];
      if (!holder || !target) return;
      ctx.deal(
        {
          shape: "single",
          main: benedictionMultiplier,
          combatType: "Thunder",
          onlyTags: ["additional"],
        },
        {
          attacker: holder,
          targets: [target],
          origin: "skill",
          abilityId: "benediction",
        }
      );
    }
  );

  k.on("actionEnd", "talent", { attack: true }, (ctx, event) => {
    const holder = benedictionHolder(ctx.allies);
    if (!holder || holder === ctx.self) return;
    for (const enemy of event.targetsHit ?? []) {
      ctx.deal(
        {
          shape: "single",
          main: k.param("04", 1),
          combatType: "Thunder",
          onlyTags: ["additional"],
        },
        {
          attacker: holder,
          targets: [enemy],
          origin: "talent",
          abilityId: "violetSparknado",
        }
      );
    }
  });

  // The game grants this Energy as a fixed amount (FixedAddValue).
  const ultimateEnergy = k.param("03", 1) + (k.e(6) ? k.rankParam(6, 1) : 0);
  // The Benediction holder, else the Skill's choice.
  const ultimateTarget = (view: {
    self: UnitView;
    allies: readonly UnitView[];
  }) => benedictionHolder(view.allies) ?? carry(view);
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "ally",
    before: (ctx) => {
      const target =
        ctx.target && !isEnemy(ctx.target) ? ctx.target : ultimateTarget(ctx);
      ctx.gainEnergy(target, ultimateEnergy, { fixed: true });
      ctx.applyStatus(target, rejoicingClouds);
    },
  });

  if (k.e(1)) {
    const windfall = k.status({
      id: "windfall-of-lucky-springs",
      origin: "e1",
      duration: { turns: 1 },
      modifiers: [{ stat: "spdPct", value: k.rankParam(1, 1) }],
    });
    k.on(
      "actionEnd",
      "e1",
      {
        subject: "ally",
        abilityKinds: ["ultimate"],
        when: (event) => hasBenediction(event.unit),
      },
      (ctx, event) => ctx.applyStatus(event.unit, windfall)
    );
  }

  if (k.e(2) && k.toggle("e2-defeat", "e2", "enemyDefeated", false)) {
    // Assumes the holder defeats an enemy with each attack.
    k.on(
      "actionEnd",
      "e2",
      {
        subject: "ally",
        attack: true,
        when: (event) => hasBenediction(event.unit),
        limitPerTurn: 1,
      },
      (ctx, event) => ctx.gainEnergy(event.unit, k.rankParam(2, 1))
    );
  }

  const refreshAfter = benedictionTurns - 1;
  k.policy({
    // Skill when Benediction is missing or in its last turn, else Basic ATK.
    turn: (view) => {
      const due =
        benedictionHolder(view.allies) === null ||
        view.self.counter(HOLDER_TURNS) >= refreshAfter;
      return due && view.skillPoints >= 1
        ? { ability: "skill", target: carry(view) }
        : "basic";
    },
    ultimate: (view) => ({ ability: "ultimate", target: ultimateTarget(view) }),
  });
});
