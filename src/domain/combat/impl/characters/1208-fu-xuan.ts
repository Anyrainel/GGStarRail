import type { BattleApi, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Fu Xuan — Preservation, Quantum. */
export default defineCharacter("1208", (k) => {
  // Talent HP Restore trigger counts: 1 at battle start, up to 2 (no
  // placeholders).
  const RESTORE_COUNT = "hp-restore-count";
  const RESTORE_START = 1;
  const RESTORE_MAX = 2;
  // E6 tally of HP lost, in units of Fu Xuan's Max HP.
  const HP_LOST = "hp-lost-tally";

  // The Matrix's DMG redistribution and Misfortune Avoidance's DMG
  // reduction are not modelled (U12): enemy attacks take HP from the ally
  // hit (tracker fu-xuan-matrix-hp).
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
    duration: { turns: k.param("02", 3), clock: "applier" },
    modifiers: knowledgeModifiers,
  });
  const matrixActive = (self: UnitView) => self.has(knowledge, self);

  /** Restores `amount` HP to `target`, with Fu Xuan's Outgoing Healing. */
  const heal = (ctx: BattleApi, target: UnitView, amount: number) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    const boost = 1 + ctx.self.currentStat("outgoingHealing");
    ctx.heal(target, (amount * boost) / maxHp);
  };

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
      if (k.a(1) && matrixActive(ctx.self)) {
        ctx.gainEnergy(ctx.self, k.traceParam(1, 1));
      }
    },
    after: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, knowledge);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    // E6: DMG +#1 of the tally, which is in units of her Max HP, so it adds
    // to the HP multiplier.
    hits: (ctx) => [
      {
        shape: "aoe",
        stat: "hp",
        each:
          k.param("03", 1) +
          (k.e(6) ? k.rankParam(6, 1) * ctx.self.counter(HP_LOST) : 0),
        toughness: { each: 20 },
      },
    ],
    after: (ctx) => {
      ctx.addCounter(ctx.self, RESTORE_COUNT, 1, RESTORE_MAX);
      if (k.e(6)) ctx.setCounter(ctx.self, HP_LOST, 0);
      if (k.a(2)) {
        const amount =
          k.traceParam(2, 1) * ctx.self.panelStat("hp") + k.traceParam(2, 2);
        for (const ally of ctx.allies) {
          if (ally !== ctx.self) heal(ctx, ally, amount);
        }
      }
    },
  });

  // Talent: at #2 of her Max HP or less, restore #3 of the HP she is
  // missing, using a trigger count. HP is an expected share, so a weighted
  // hit uses up the same share of a count (and of the heal).
  k.on("battleStart", "talent", { subject: "any" }, (ctx) =>
    ctx.setCounter(ctx.self, RESTORE_COUNT, RESTORE_START)
  );
  k.on(
    "hpChanged",
    "talent",
    {
      when: (event, self) =>
        (event.delta ?? 0) < 0 &&
        self.hpRatio <= k.param("04", 2) + 1e-9 &&
        self.counter(RESTORE_COUNT) > 1e-9,
    },
    (ctx) => {
      const used = Math.min(1, ctx.self.counter(RESTORE_COUNT) / ctx.weight);
      ctx.addCounter(ctx.self, RESTORE_COUNT, -used);
      const missing = (1 - ctx.self.hpRatio) * ctx.self.panelStat("hp");
      heal(ctx, ctx.self, k.param("04", 3) * missing * used);
    }
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

  if (k.e(6)) {
    // HP lost by every ally while the Matrix is active, capped at #2 of her
    // Max HP. Memosprites read their owner's Max HP
    // (engine-memosprite-max-hp).
    k.on(
      "hpChanged",
      "e6",
      {
        subject: "ally",
        when: (event, self) => (event.delta ?? 0) < 0 && matrixActive(self),
      },
      (ctx, event) => {
        const ownMaxHp = ctx.self.panelStat("hp");
        if (ownMaxHp <= 0) return;
        const lost = -(event.delta ?? 0) * event.unit.panelStat("hp");
        ctx.addCounter(ctx.self, HP_LOST, lost / ownMaxHp, k.rankParam(6, 2));
      }
    );
  }

  // Skill on the Matrix's last turn (Skill, Basic ATK, Basic ATK, ...) so it
  // never lapses and A2's extra Energy applies; Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      view.skillPoints >= 1 &&
      (view.self.remainingTurns(knowledge, view.self) ?? 0) <= 1
        ? "skill"
        : "basic",
  });
});
