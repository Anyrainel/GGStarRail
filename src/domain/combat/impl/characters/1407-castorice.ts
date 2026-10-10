import type { BattleApi, PolicyView, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Castorice — Remembrance, Quantum. */
export default defineCharacter("1407", (k) => {
  const NETHERWING = "11407";
  // Max Newbud depends on the Characters' levels and is not in the text or
  // data: 5.3125 × level² is 34,000 at level 80 (tracker castorice-max-newbud).
  const maxNewbud = 34000;
  const netherwingMaxHp = k.param("03", 3) * maxNewbud;
  const netherwingTurns = k.param("03", 2);

  // HP is not simulated (tracker castorice-hp-model). Allies lose HP from
  // their current HP, assumed at 80% of Max HP with a sustain; each enemy
  // attack costs its target 10% Max HP. Memosprites' HP is unknown and they
  // are left out of "all allies". With A2, the sustain's healing restores
  // what was lost and converts it again.
  const currentHp = 0.8;
  const enemyHitHp = 0.1;
  const healed = k.a(1) && k.toggle("healing-converted", "a2", "active", true);

  const desolation = k.status({
    id: "desolation-across-palms",
    origin: "talent",
    duration: { turns: k.param("04", 4) },
    maxStacks: k.param("04", 3),
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 2) }],
  });
  // A Territory rather than a debuff on the enemies.
  const lostNetherland = k.status({
    id: "lost-netherland",
    origin: "ultimate",
    modifiers: [{ stat: "resReduction", value: k.param("03", 4) }],
  });
  const roar = k.status({
    id: "roar-rumbles-the-realm",
    origin: "memospriteTalent",
    duration: { turns: k.param("1140705", 2) },
    modifiers: [{ stat: "dmgBoost", value: k.param("1140705", 1) }],
  });
  const westWind = k.status({
    id: "where-the-west-wind-dwells",
    origin: "a6",
    maxStacks: k.traceParam(3, 2),
    modifiers: [{ stat: "dmgBoost", value: k.traceParam(3, 1) }],
  });
  // Memosprite SPD statuses add flat SPD: +100% of Netherwing's 165 SPD.
  const invertedTorch = k.status({
    id: "inverted-torch-spd",
    origin: "a4",
    duration: { turns: 1 },
    modifiers: [
      { stat: "spdFlat", value: k.traceParam(2, 3) * k.param("03", 1) },
    ],
  });

  if (k.a(2)) {
    const above = k.toggle(
      "a4-hp-above",
      "a4",
      "selfHpAbove",
      true,
      k.traceParam(2, 1)
    );
    if (above) k.stat("a4", { stat: "spdPct", value: k.traceParam(2, 2) });
  }
  const breathDefeats =
    k.a(2) && k.toggle("a4-breath-defeats", "a4", "enemyDefeated", false);

  if (k.e(1)) {
    // Boneclaw, Claw, Breath, and Wings: Joint ATK and memosprite DMG.
    const below50 = k.toggle(
      "e1-enemy-hp-low",
      "e1",
      "enemyHpBelow",
      true,
      k.rankParam(1, 2)
    );
    const below80 = k.toggle(
      "e1-enemy-hp",
      "e1",
      "enemyHpBelow",
      true,
      k.rankParam(1, 1)
    );
    const ratio = below50 ? k.rankParam(1, 4) : below80 ? k.rankParam(1, 3) : 1;
    if (ratio > 1) {
      k.stat("e1", {
        stat: "dmgMultiplier",
        value: ratio - 1,
        filter: { tags: ["joint", "memosprite"] },
      });
    }
  }
  if (k.e(6)) {
    k.stat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 1),
      filter: { combatTypes: ["Quantum"] },
    });
  }

  const findNetherwing = (ctx: BattleApi, castorice: UnitView) =>
    ctx.findSummon(castorice, NETHERWING);
  const netherwingPresent = (view: PolicyView) =>
    view.allies.some(
      (unit) => unit.owner === view.self && unit.definitionId === NETHERWING
    );
  const allyCharacters = (ctx: BattleApi) =>
    ctx.allies.filter((unit) => unit.kind === "character");

  /**
   * Allies (except Netherwing) lose HP: Newbud, or Netherwing's HP while it
   * is on the field, and a Talent stack per ally.
   */
  const loseHp = (
    ctx: BattleApi,
    castorice: UnitView,
    amounts: readonly number[]
  ) => {
    const netherwing = findNetherwing(ctx, castorice);
    let gained = 0;
    for (const amount of amounts) {
      gained += amount;
      if (healed) {
        gained += Math.min(
          amount * k.traceParam(1, 1),
          k.traceParam(1, 2) * maxNewbud
        );
      }
    }
    if (netherwing) ctx.addCounter(netherwing, "hp", gained, netherwingMaxHp);
    else ctx.addCounter(castorice, "newbud", gained, maxNewbud);
    const stacks = amounts.length * ctx.weight;
    ctx.applyStatus(castorice, desolation, { stacks });
    if (netherwing) ctx.applyStatus(netherwing, desolation, { stacks });
  };

  const consumeHp = (ctx: BattleApi, fraction: number) =>
    loseHp(
      ctx,
      ctx.self,
      allyCharacters(ctx).map(
        (ally) => fraction * currentHp * ally.panelStat("hp")
      )
    );

  const netherwingToughness = k.e(6) ? { toughnessWithoutWeakness: 1 } : {};
  const wingsHit = (skillId: string): HitDef => ({
    shape: "bounce",
    each: k.param(skillId, 1),
    bounces: k.param(skillId, 2) + (k.e(6) ? k.rankParam(6, 2) : 0),
    stat: "hp",
    statOwner: "owner",
    toughness: { each: 5 },
    ...netherwingToughness,
  });

  /** Netherwing disappears and dispels the Territory. */
  const netherwingLeaves = (
    ctx: BattleApi,
    castorice: UnitView,
    netherwing: UnitView,
    sweep: boolean
  ) => {
    if (sweep) {
      ctx.deal(wingsHit("1140706"), {
        attacker: netherwing,
        abilityId: "wingsSweepTheRuins",
        abilityKind: "memospriteSkill",
        origin: "memospriteTalent",
        tags: ["memosprite"],
      });
    }
    for (const enemy of ctx.enemies) ctx.removeStatus(enemy, lostNetherland);
    ctx.dismiss(netherwing);
    ctx.setCounter(castorice, "ardent-will", 0);
  };

  // Both Skills cost HP instead of Skill Points (facts) and Castorice has no
  // Energy.
  k.ability({
    id: "basic",
    kind: "basic",
    energy: 0,
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        stat: "hp",
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    energy: 0,
    skillPoints: 0,
    usable: (view) => !netherwingPresent(view),
    before: (ctx) => consumeHp(ctx, k.param("02", 1)),
    hits: [
      {
        shape: "blast",
        main: k.param("02", 2),
        adjacent: k.param("02", 3),
        stat: "hp",
        toughness: { main: 20, adjacent: 10 },
      },
    ],
  });

  // Boneclaw: Castorice's part carries the facts' Toughness; Netherwing
  // deals its own part.
  k.ability({
    id: "enhancedSkill",
    kind: "skill",
    tags: ["joint"],
    energy: 0,
    skillPoints: 0,
    usable: netherwingPresent,
    before: (ctx) => {
      consumeHp(ctx, k.param("09", 1));
      if (k.e(2) && ctx.self.counter("e2-newbud") > 0) {
        ctx.setCounter(ctx.self, "e2-newbud", 0);
        ctx.addCounter(
          ctx.self,
          "newbud",
          k.rankParam(2, 3) * maxNewbud,
          maxNewbud
        );
      }
    },
    hits: [
      {
        shape: "aoe",
        each: k.param("09", 2),
        stat: "hp",
        toughness: { each: 20 },
      },
    ],
    after: (ctx) => {
      const netherwing = findNetherwing(ctx, ctx.self);
      if (!netherwing) return;
      ctx.deal(
        {
          shape: "aoe",
          each: k.param("09", 3),
          stat: "hp",
          statOwner: "owner",
        },
        { attacker: netherwing, tags: ["skill", "joint", "memosprite"] }
      );
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    energy: 0,
    resource: { counter: "newbud", amount: maxNewbud },
    usable: (view) => !netherwingPresent(view),
    before: (ctx) => {
      const netherwing = ctx.summon(ctx.self, NETHERWING);
      ctx.advanceAction(netherwing, 1);
      ctx.setCounter(netherwing, "hp", netherwingMaxHp);
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, lostNetherland);
      const stacks = ctx.self.stacks(desolation);
      if (stacks > 0) {
        ctx.applyStatus(netherwing, desolation, { setStacks: stacks });
      }
      for (const ally of ctx.allies) ctx.applyStatus(ally, roar);
      if (k.e(2)) {
        ctx.setCounter(ctx.self, "ardent-will", k.rankParam(2, 1));
        ctx.setCounter(ctx.self, "e2-newbud", 1);
      }
    },
  });

  const breathCost = k.param("1140702", 1) * netherwingMaxHp;
  const wingsThreshold = k.param("1140702", 5) * netherwingMaxHp;
  // "increased progressively to #3/#4", kept until Netherwing disappears.
  const breathMultipliers = [
    k.param("1140702", 2),
    k.param("1140702", 3),
    k.param("1140702", 4),
  ];
  const hasArdentWill = (castorice: UnitView | null) =>
    k.e(2) && (castorice?.counter("ardent-will") ?? 0) >= 1 - 1e-9;

  k.memosprite({
    servantId: NETHERWING,
    speed: { flat: k.param("03", 1) },
    abilities: [
      {
        id: "clawSplitsTheVeil",
        kind: "memospriteSkill",
        hits: [
          {
            shape: "aoe",
            each: k.param("1140701", 1),
            stat: "hp",
            statOwner: "owner",
            toughness: { each: 10 },
            ...netherwingToughness,
          },
        ],
      },
      {
        id: "breathScorchesTheShadow",
        kind: "memospriteSkill",
        endsTurn: false,
        before: (ctx) => {
          const castorice = ctx.self.owner;
          if (castorice && hasArdentWill(castorice)) {
            ctx.addCounter(castorice, "ardent-will", -1);
            ctx.advanceAction(castorice, 1);
          } else {
            ctx.addCounter(ctx.self, "hp", -breathCost);
          }
          if (k.a(3)) ctx.applyStatus(ctx.self, westWind);
        },
        hits: (ctx) => [
          {
            shape: "aoe",
            each: breathMultipliers[
              Math.min(
                breathMultipliers.length - 1,
                ctx.self.counter("breaths")
              )
            ],
            stat: "hp",
            statOwner: "owner",
            toughness: { each: 10 },
            ...netherwingToughness,
          },
        ],
        after: (ctx) => {
          ctx.addCounter(ctx.self, "breaths", 1);
          if (breathDefeats) ctx.applyStatus(ctx.self, invertedTorch);
        },
      },
      {
        // Breath at or below #5 HP: consumes all HP, then Netherwing leaves.
        id: "wingsSweepTheRuins",
        kind: "memospriteSkill",
        hits: [wingsHit("1140712")],
        after: (ctx) => {
          const castorice = ctx.self.owner;
          if (castorice) netherwingLeaves(ctx, castorice, ctx.self, false);
        },
      },
    ],
    // Breath while HP stays above the Wings threshold, Claw to end earlier
    // turns, and spend the remaining HP on the last turn ending with Wings.
    policy: (view) => {
      const hp = view.self.counter("hp");
      if (hp <= wingsThreshold + 1e-6) return "wingsSweepTheRuins";
      const lastTurn = view.self.counter("turns") >= netherwingTurns - 1;
      if (
        lastTurn ||
        hasArdentWill(view.self.owner) ||
        hp - breathCost > wingsThreshold + 1e-6
      ) {
        return "breathScorchesTheShadow";
      }
      return "clawSplitsTheVeil";
    },
  });

  k.on("turnEnd", "ultimate", { subject: "memosprite" }, (ctx, event) => {
    const netherwing = findNetherwing(ctx, ctx.self);
    // Gone already when it left during its own turn.
    if (!netherwing || event.unit !== netherwing) return;
    ctx.removeStatus(netherwing, westWind);
    ctx.addCounter(netherwing, "turns", 1);
    if (netherwing.counter("turns") >= netherwingTurns - 1e-9) {
      netherwingLeaves(ctx, ctx.self, netherwing, true);
    }
  });

  k.on(
    "hitByEnemy",
    "talent",
    { subject: "ally", when: (event) => event.unit.kind === "character" },
    (ctx, event) =>
      loseHp(ctx, ctx.self, [enemyHitHp * event.unit.panelStat("hp")])
  );

  // Skill every turn (it costs HP, not Skill Points); Boneclaw while
  // Netherwing is on the field.
  k.policy({
    turn: (view) => (netherwingPresent(view) ? "enhancedSkill" : "skill"),
  });
});
