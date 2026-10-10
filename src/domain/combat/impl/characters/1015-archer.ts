import { type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Archer — The Hunt, Quantum. */
export default defineCharacter("1015", (k) => {
  // The game data has no combat facts for Archer; Toughness and Energy below
  // use the usual values of each ability type (tracked as needs-data).
  const maxCharge = k.param("03", 3);
  const maxCasts = k.param("02", 5);

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

  // In Circuit Connection the turn does not end after a Skill: the next Skill
  // is queued in the same turn until 5 casts or Skill Points run out.
  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      if (ctx.self.has(circuit)) return;
      ctx.applyStatus(ctx.self, circuit);
      ctx.setCounter(ctx.self, "circuit-casts", 0);
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      ctx.addCounter(ctx.self, "circuit-casts", 1);
      ctx.addCounter(ctx.self, "turn-casts", 1);
      ctx.applyStatus(ctx.self, circuitBoost);
      if (k.e(1) && ctx.self.counter("turn-casts") === k.rankParam(1, 1)) {
        ctx.gainSkillPoints(k.rankParam(1, 2));
      }
    },
  });

  // Decided at actionEnd: an ability context's skillPoints is a snapshot
  // taken when the action started, so it misses E1's refund.
  k.on("actionEnd", "skill", { abilityKinds: ["skill"] }, (ctx, event) => {
    if (!ctx.self.has(circuit)) return;
    if (ctx.self.counter("circuit-casts") >= maxCasts || ctx.skillPoints < 1) {
      ctx.removeStatus(ctx.self, circuit);
      ctx.removeStatus(ctx.self, circuitBoost);
      return;
    }
    ctx.queueAction(ctx.self, "skill", {
      target: isEnemy(event.target) ? event.target : undefined,
    });
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (!e2Res || !isEnemy(ctx.target)) return;
      ctx.applyStatus(ctx.target, e2Res);
      // The engine cannot expire an implanted Weakness after 2 turns.
      ctx.implantWeakness(ctx.target, "Quantum");
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
    ctx.setCounter(ctx.self, "sp-seen", ctx.skillPoints);
    if (k.a(2)) {
      ctx.addCounter(ctx.self, "charge", k.traceParam(2, 1), maxCharge);
    }
  });

  k.on("turnStart", "skill", {}, (ctx) => {
    ctx.setCounter(ctx.self, "turn-casts", 0);
    if (k.e(6)) {
      // "When the turn starts, recovers 1 Skill Point" (no parameter).
      ctx.gainSkillPoints(1);
      checkGuardian(ctx);
      ctx.setCounter(ctx.self, "sp-seen", ctx.skillPoints);
    }
  });

  // A6 reacts to Skill Point gains, which have no event: compare the count
  // around every ally action (Basic ATK gains land before actionStart, kit
  // refunds before actionEnd).
  if (k.a(3)) {
    const watch = (ctx: BattleApi) => {
      if (ctx.skillPoints > ctx.self.counter("sp-seen") + 1e-9) {
        checkGuardian(ctx);
      }
      ctx.setCounter(ctx.self, "sp-seen", ctx.skillPoints);
    };
    k.on("actionStart", "a6", { subject: "ally" }, watch);
    k.on("actionEnd", "a6", { subject: "ally" }, watch);
  }

  // Start Circuit Connection only with Skill Points for at least two Skills,
  // so the chain reaches the stacking Skill DMG boost.
  k.policy({
    turn: (view) => (view.skillPoints >= 2 ? "skill" : "basic"),
  });
});
