import type {
  BattleApi,
  BattleEvent,
  PolicyView,
  UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Castorice — Remembrance, Quantum. */
export default defineCharacter("1407", (k) => {
  const NETHERWING = "11407";
  // A2: healing converted per ally target since the last action (HP points).
  const CONVERTED = "castorice-a2-converted";
  // Max Newbud depends on the Characters' levels and is not in the text or
  // data: 5.3125 × level² is 34,000 at level 80 (tracker castorice-max-newbud).
  const maxNewbud = 34000;
  const netherwingMaxHp = k.param("03", 3) * maxNewbud;
  const netherwingTurns = k.param("03", 2);

  const desolation = k.status({
    id: "desolation-across-palms",
    origin: "talent",
    duration: { turns: k.param("04", 4) },
    maxStacks: k.param("04", 3),
    modifiers: [{ stat: "dmgBoost", value: k.param("04", 2) }],
  });
  // A Territory; its RES reduction is a debuff (AvatarStatusConfig 10014071).
  const lostNetherland = k.status({
    id: "lost-netherland",
    origin: "ultimate",
    debuff: true,
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
  const torch = k.status({
    id: "inverted-torch",
    origin: "a4",
    modifiers: [{ stat: "spdPct", value: k.traceParam(2, 2) }],
  });
  const invertedTorch = k.status({
    id: "inverted-torch-spd",
    origin: "a4",
    duration: { turns: 1 },
    modifiers: [{ stat: "spdPct", value: k.traceParam(2, 3) }],
  });

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
  const isNetherwing = (unit: UnitView, castorice: UnitView) =>
    unit.owner === castorice && unit.definitionId === NETHERWING;
  // Ally targets: Characters and memosprites, not countdowns.
  const allyTargets = (ctx: BattleApi) =>
    ctx.allies.filter((unit) => unit.kind !== "summon");

  /**
   * Newbud, or Netherwing's HP while it is on the field. Netherwing's HP is
   * a counter in HP points: the game raises it with SetHP, which the
   * engine's HP model can only express as healing (engine-hp-gain-not-heal).
   */
  const gainNewbud = (ctx: BattleApi, castorice: UnitView, amount: number) => {
    const netherwing = findNetherwing(ctx, castorice);
    if (netherwing) ctx.addCounter(netherwing, "hp", amount, netherwingMaxHp);
    else ctx.addCounter(castorice, "newbud", amount, maxNewbud);
  };

  /** "When allies lose HP": a DMG stack for Castorice and Netherwing. */
  const allyLostHp = (ctx: BattleApi, castorice: UnitView) => {
    ctx.applyStatus(castorice, desolation, { stacks: ctx.weight });
    const netherwing = findNetherwing(ctx, castorice);
    if (netherwing) {
      ctx.applyStatus(netherwing, desolation, { stacks: ctx.weight });
    }
  };

  // Skills: "consumes X% of all allies' current HP" (down to 1 HP).
  const consumeAllies = (ctx: BattleApi, fraction: number) => {
    for (const ally of allyTargets(ctx)) {
      if (isNetherwing(ally, ctx.self)) continue;
      ctx.consumeHp(ally, ally.hpRatio * fraction);
    }
  };

  // Talent: every point of HP lost by an ally (except Netherwing) to a cost
  // or an enemy attack. Memosprites report their owner's Max HP
  // (engine-memosprite-max-hp). Netherwing taking over losses below 1 HP
  // (Mooncocoon) is not modeled: the engine stops at 1% HP.
  const lostHp = (event: BattleEvent, castorice: UnitView) =>
    (event.hpCause === "consume" || event.hpCause === "enemy") &&
    (event.delta ?? 0) < 0 &&
    event.unit.kind !== "summon" &&
    !isNetherwing(event.unit, castorice);
  k.on(
    "hpChanged",
    "talent",
    { subject: "ally", when: lostHp },
    (ctx, event) => {
      gainNewbud(
        ctx,
        ctx.self,
        -(event.delta ?? 0) * event.unit.panelStat("hp")
      );
      allyLostHp(ctx, ctx.self);
    }
  );

  // A2: healing received by ally targets (except Netherwing) converts, up to
  // 12% of max Newbud per target until any unit acts.
  if (k.a(1)) {
    const cap = k.traceParam(1, 2) * maxNewbud;
    k.on(
      "hpChanged",
      "a2",
      {
        subject: "ally",
        when: (event, self) =>
          event.hpCause === "heal" &&
          (event.delta ?? 0) > 0 &&
          event.unit.kind !== "summon" &&
          !isNetherwing(event.unit, self),
      },
      (ctx, event) => {
        const healed =
          (event.delta ?? 0) * event.unit.panelStat("hp") * k.traceParam(1, 1);
        const amount = Math.min(
          healed,
          Math.max(0, cap - event.unit.counter(CONVERTED))
        );
        if (amount <= 0) return;
        ctx.addCounter(event.unit, CONVERTED, amount);
        gainNewbud(ctx, ctx.self, amount);
      }
    );
    k.on("actionEnd", "a2", { subject: "any" }, (ctx) => {
      for (const ally of ctx.allies) {
        if (ally.counter(CONVERTED) > 0) ctx.setCounter(ally, CONVERTED, 0);
      }
    });
  }

  // A4: SPD while Castorice's HP is at least 50%.
  if (k.a(2)) {
    const syncTorch = (ctx: BattleApi) => {
      const above = ctx.self.hpRatio + 1e-9 >= k.traceParam(2, 1);
      if (above && !ctx.self.has(torch)) ctx.applyStatus(ctx.self, torch);
      if (!above && ctx.self.has(torch)) ctx.removeStatus(ctx.self, torch);
    };
    k.on("battleStart", "a4", { subject: "any" }, syncTorch);
    k.on("hpChanged", "a4", {}, syncTorch);
  }

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

  /** Wings Sweep the Ruins heals all allies: 6% of Castorice's Max HP + 800. */
  const wingsHeal = (ctx: BattleApi, castorice: UnitView, skillId: string) => {
    const amount =
      (k.param(skillId, 3) * castorice.panelStat("hp") + k.param(skillId, 4)) *
      (1 + castorice.panelStat("outgoingHealing"));
    for (const ally of allyTargets(ctx)) {
      if (isNetherwing(ally, castorice)) continue;
      const maxHp = ally.panelStat("hp");
      if (maxHp > 0) ctx.heal(ally, amount / maxHp);
    }
  };

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
      // While Netherwing is leaving, A2 converts this healing into nothing.
      wingsHeal(ctx, castorice, "1140706");
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
    before: (ctx) => consumeAllies(ctx, k.param("02", 1)),
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
      consumeAllies(ctx, k.param("09", 1));
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
            // Netherwing is an ally losing HP: the Talent's DMG stack.
            if (castorice) allyLostHp(ctx, castorice);
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
        // Breath at or below #5 HP: reduces HP to 1, then Wings; Netherwing
        // leaves after consuming all its HP.
        id: "wingsSweepTheRuins",
        kind: "memospriteSkill",
        before: (ctx) => {
          const castorice = ctx.self.owner;
          ctx.setCounter(ctx.self, "hp", 0);
          if (castorice) allyLostHp(ctx, castorice);
        },
        hits: [wingsHit("1140712")],
        after: (ctx) => {
          const castorice = ctx.self.owner;
          if (!castorice) return;
          wingsHeal(ctx, castorice, "1140712");
          netherwingLeaves(ctx, castorice, ctx.self, false);
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

  // Skill every turn (it costs HP, not Skill Points); Boneclaw while
  // Netherwing is on the field.
  k.policy({
    turn: (view) => (netherwingPresent(view) ? "enhancedSkill" : "skill"),
  });
});
