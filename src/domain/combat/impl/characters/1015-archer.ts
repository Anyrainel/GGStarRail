import { type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Archer — The Hunt, Quantum. */
export default defineCharacter("1015", (k) => {
  const maxCharge = k.param("03", 3);
  const maxCasts = k.param("02", 5);
  // facts: the Skill consumes 2 Skill Points.
  const skillCost = 2;

  const CIRCUIT_CASTS = "circuit-casts";
  const TURN_CASTS = "turn-casts";
  const circuit = k.status({ id: "circuit-connection", origin: "skill" });
  const circuitBoost = k.status({
    id: "circuit-connection-dmg",
    origin: "skill",
    maxStacks: k.param("02", 3) + (k.e(6) ? k.rankParam(6, 1) : 0),
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.param("02", 2),
        filter: { tags: ["skill"] },
      },
    ],
  });

  const guardian = k.a(3)
    ? k.status({
        id: "guardian",
        origin: "a6",
        duration: { turns: k.traceParam(3, 2) },
        modifiers: [{ stat: "critDmg", value: k.traceParam(3, 1) }],
      })
    : null;
  const checkGuardian = (ctx: BattleApi) => {
    if (guardian && ctx.skillPoints >= k.traceParam(3, 3) - 1e-9) {
      ctx.applyStatus(ctx.self, guardian);
    }
  };

  const e2Res = k.e(2)
    ? k.status({
        id: "e2-quantum-res",
        origin: "e2",
        debuff: true,
        duration: { turns: k.rankParam(2, 2) },
        modifiers: [
          {
            stat: "resReduction",
            value: k.rankParam(2, 1),
            filter: { combatTypes: ["Quantum"] },
          },
        ],
      })
    : null;

  if (k.e(4)) {
    k.stat("e4", {
      stat: "dmgBoost",
      value: k.rankParam(4, 1),
      filter: { tags: ["ultimate"] },
    });
  }
  if (k.e(6)) {
    k.stat("e6", {
      stat: "defIgnore",
      value: k.rankParam(6, 2),
      filter: { tags: ["skill"] },
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  const exitCircuit = (ctx: BattleApi) => {
    ctx.removeStatus(ctx.self, circuit);
    ctx.removeStatus(ctx.self, circuitBoost);
  };
  // "After using Skill in Circuit Connection, the current turn does not
  // end": `skill` keeps the turn going, `skillLast` is the cast after which
  // Circuit Connection ends (the #5th cast, or too few Skill Points for
  // another), and ends the turn with it.
  const skillDef = (id: string, last: boolean) =>
    k.ability({
      id,
      kind: "skill",
      skillPoints: -skillCost,
      endsTurn: last,
      before: (ctx) => {
        if (ctx.self.has(circuit)) return;
        ctx.applyStatus(ctx.self, circuit);
        ctx.setCounter(ctx.self, CIRCUIT_CASTS, 0);
      },
      hits: [
        { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
      ],
      after: (ctx) => {
        ctx.addCounter(ctx.self, CIRCUIT_CASTS, 1);
        ctx.addCounter(ctx.self, TURN_CASTS, 1);
        ctx.applyStatus(ctx.self, circuitBoost);
        if (k.e(1) && ctx.self.counter(TURN_CASTS) === k.rankParam(1, 1)) {
          ctx.gainSkillPoints(k.rankParam(1, 2));
        }
        if (last) exitCircuit(ctx);
      },
    });
  skillDef("skill", false);
  skillDef("skillLast", true);
  // Circuit Connection never outlasts his turn.
  k.on("turnEnd", "skill", {}, exitCircuit);

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (!e2Res || !isEnemy(ctx.target)) return;
      ctx.applyStatus(ctx.target, e2Res);
      ctx.implantWeakness(ctx.target, "Quantum", { turns: k.rankParam(2, 2) });
    },
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) =>
      ctx.addCounter(ctx.self, "charge", k.param("03", 2), maxCharge),
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 5,
    hits: [
      { shape: "single", main: k.param("04", 1), toughness: { main: 10 } },
    ],
    // "recovering 1 Skill Point" (no parameter); after the DMG.
    after: (ctx) => ctx.gainSkillPoints(1),
  });

  k.on(
    "actionEnd",
    "talent",
    { subject: "otherAlly", attack: true },
    (ctx, event) => {
      if (ctx.self.counter("charge") < 1 - 1e-9) return;
      ctx.addCounter(ctx.self, "charge", -1);
      ctx.queueAction(ctx.self, "followUp", {
        target: isEnemy(event.target) ? event.target : undefined,
      });
    }
  );

  k.on("battleStart", "a4", { subject: "any" }, (ctx) => {
    if (k.a(1)) {
      ctx.setMaxSkillPoints(ctx.maxSkillPoints + k.traceParam(1, 1));
    }
    if (k.a(2)) {
      ctx.addCounter(ctx.self, "charge", k.traceParam(2, 1), maxCharge);
    }
  });

  k.on("turnStart", "skill", {}, (ctx) => {
    ctx.setCounter(ctx.self, TURN_CASTS, 0);
    // "When the turn starts, recovers 1 Skill Point" (no parameter).
    if (k.e(6)) ctx.gainSkillPoints(1);
  });

  if (k.a(3)) {
    k.on(
      "skillPointsChanged",
      "a6",
      { subject: "ally", when: (event) => (event.delta ?? 0) > 0 },
      checkGuardian
    );
  }

  k.policy({
    turn: (view) => {
      const inCircuit = view.self.has(circuit);
      // Start Circuit Connection only with Skill Points for at least two
      // Skills, so the chain reaches the stacking Skill DMG boost.
      if (!inCircuit && view.skillPoints < 2 * skillCost) return "basic";
      const casts = inCircuit ? view.self.counter(CIRCUIT_CASTS) : 0;
      const turnCasts = view.self.counter(TURN_CASTS) + 1;
      const refund =
        k.e(1) && turnCasts === k.rankParam(1, 1) ? k.rankParam(1, 2) : 0;
      const after = Math.min(
        view.maxSkillPoints,
        view.skillPoints - skillCost + refund
      );
      return casts + 1 >= maxCasts || after < skillCost - 1e-9
        ? "skillLast"
        : "skill";
    },
  });
});
