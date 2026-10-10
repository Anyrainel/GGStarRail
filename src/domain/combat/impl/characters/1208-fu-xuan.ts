import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Fu Xuan — Preservation, Quantum. */
export default defineCharacter("1208", (k) => {
  const TURNS_SINCE_MATRIX = "turns-since-matrix";
  const matrixTurns = k.param("02", 3);

  // DMG redistribution (Matrix), Misfortune Avoidance, and her HP Restore
  // are not modelled (U12).
  const knowledgeModifiers: ModifierDef[] = [
    {
      stat: "hpFlat",
      scaling: { source: "applier", stat: "hp", ratio: k.param("02", 4) },
    },
    { stat: "critRate", value: k.param("02", 5) },
  ];
  if (k.e(1)) {
    knowledgeModifiers.push({ stat: "critDmg", value: k.rankParam(1, 1) });
  }
  // Knowledge lasts as long as the Matrix: Fu Xuan's turns count it down.
  const knowledge = k.status({
    id: "knowledge",
    origin: "skill",
    duration: { turns: matrixTurns, clock: "applier" },
    modifiers: knowledgeModifiers,
  });

  // E6: HP is not simulated. On (default), the HP-loss tally has reached its
  // cap (120% of her Max HP) whenever she casts her Ultimate.
  const tallyCapped =
    k.e(6) && k.toggle("e6-hp-loss-tally-capped", "e6", "active", true);
  // The tally is in units of her Max HP, so it adds to the HP multiplier.
  const ultimateMultiplier =
    k.param("03", 1) +
    (tallyCapped ? k.rankParam(6, 1) * k.rankParam(6, 2) : 0);

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        stat: "hp",
        main: k.param("01", 1),
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "allies",
    before: (ctx) => {
      if (k.a(1) && ctx.self.has(knowledge)) {
        ctx.gainEnergy(ctx.self, k.traceParam(1, 1));
      }
    },
    after: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, knowledge);
      ctx.setCounter(ctx.self, TURNS_SINCE_MATRIX, 0);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      {
        shape: "aoe",
        stat: "hp",
        each: ultimateMultiplier,
        toughness: { each: 20 },
      },
    ],
  });

  k.on("turnEnd", "skill", {}, (ctx) =>
    ctx.addCounter(ctx.self, TURNS_SINCE_MATRIX, 1)
  );

  if (k.e(4)) {
    k.on(
      "hitByEnemy",
      "e4",
      {
        subject: "otherAlly",
        when: (event, self) => event.unit.has(knowledge, self),
      },
      (ctx) => ctx.gainEnergy(ctx.self, k.rankParam(4, 1))
    );
  }

  // Skill on the Matrix's last turn (Skill, Basic ATK, Basic ATK, ...) so it
  // never lapses and A2's extra Energy applies; Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      view.skillPoints >= 1 &&
      (!view.self.has(knowledge) ||
        view.self.counter(TURNS_SINCE_MATRIX) >= matrixTurns)
        ? "skill"
        : "basic",
  });
});
