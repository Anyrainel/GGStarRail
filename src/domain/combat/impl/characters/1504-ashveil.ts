import { type BattleApi, type EnemyView, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef, ModifierDef } from "../../kit/model";

/** Ashveil — The Hunt, Lightning. */
export default defineCharacter("1504", (k) => {
  const maxCharge = k.param("04", 2);
  const gluttonyCost = k.param("03", 3);

  // StatusType Other in the game's status config: not a debuff.
  const bait = k.status({ id: "bait", origin: "skill" });
  // Bait always exists (a new one is chosen whenever none is left), so the
  // field effects that require it last the whole battle.
  const baitDefReduction = k.status({
    id: "bait-def-reduction",
    origin: "skill",
    debuff: true,
    modifiers: [{ stat: "defReduction", value: k.param("02", 4) }],
  });

  const gluttonyModifiers: ModifierDef[] = [];
  if (k.a(2)) {
    gluttonyModifiers.push({
      stat: "dmgBoost",
      value: k.traceParam(2, 3) / k.traceParam(2, 2),
      filter: { tags: ["followUp"] },
    });
    k.stat("a4", {
      stat: "dmgBoost",
      value: k.traceParam(2, 1),
      filter: { tags: ["followUp"] },
    });
  }
  const gluttony = k.status({
    id: "gluttony",
    origin: "talent",
    maxStacks: k.e(2) ? k.rankParam(2, 1) : k.param("04", 6),
    modifiers: gluttonyModifiers,
  });

  const e6Gained = k.e(6)
    ? k.status({
        id: "e6-gluttony-gained",
        origin: "e6",
        maxStacks: k.rankParam(6, 3),
        modifiers: [{ stat: "dmgBoost", value: k.rankParam(6, 2) }],
      })
    : null;

  // Gains inside a weighted action (a probabilistic ally attack on the Bait)
  // are expected values; applyStatus itself ignores the action weight.
  const gainGluttony = (ctx: BattleApi, amount: number) => {
    const before = ctx.self.stacks(gluttony);
    ctx.applyStatus(ctx.self, gluttony, { stacks: amount * ctx.weight });
    const gained = ctx.self.stacks(gluttony) - before;
    if (e6Gained && gained > 0) {
      ctx.applyStatus(ctx.self, e6Gained, { stacks: gained });
    }
  };

  const makeBait = (ctx: BattleApi, target: EnemyView) => {
    for (const enemy of ctx.enemies) {
      if (enemy !== target) ctx.removeStatus(enemy, bait);
    }
    ctx.applyStatus(target, bait);
  };

  const fieldStatuses = [baitDefReduction];
  if (k.e(1)) {
    const lowHp = k.toggle(
      "e1-low-hp",
      "e1",
      "enemyHpBelow",
      true,
      k.rankParam(1, 2)
    );
    fieldStatuses.push(
      k.status({
        id: "e1-vulnerability",
        origin: "e1",
        debuff: true,
        modifiers: [
          {
            stat: "vulnerability",
            value: lowHp ? k.rankParam(1, 3) : k.rankParam(1, 1),
          },
        ],
      })
    );
  }
  if (k.e(6)) {
    fieldStatuses.push(
      k.status({
        id: "e6-res-reduction",
        origin: "e6",
        debuff: true,
        modifiers: [{ stat: "resReduction", value: k.rankParam(6, 1) }],
      })
    );
  }

  if (k.a(3)) {
    k.teamStat("a6", { stat: "critDmg", value: k.traceParam(3, 1) });
    k.teamStat("a6", {
      stat: "critDmg",
      value: k.traceParam(3, 2),
      filter: { tags: ["followUp"] },
    });
  }

  const e4Atk = k.e(4)
    ? k.status({
        id: "e4-atk",
        origin: "e4",
        duration: { turns: k.rankParam(4, 2) },
        modifiers: [{ stat: "atkPct", value: k.rankParam(4, 1) }],
      })
    : null;

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    ctx.setCounter(ctx.self, "charge", k.param("04", 1));
    // No HP model: the first enemy stands in for the lowest-HP one.
    const first = ctx.enemies[0];
    if (first) makeBait(ctx, first);
    for (const enemy of ctx.enemies) {
      for (const status of fieldStatuses) ctx.applyStatus(enemy, status);
    }
  });

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      const onBait = isEnemy(ctx.target) && ctx.target.has(bait);
      ctx.setCounter(ctx.self, "skill-on-bait", onBait ? 1 : 0);
      if (isEnemy(ctx.target)) makeBait(ctx, ctx.target);
      if (k.a(1)) gainGluttony(ctx, k.traceParam(1, 1));
    },
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target) || ctx.self.counter("skill-on-bait") === 0) {
        return;
      }
      ctx.deal(
        { shape: "single", main: k.param("02", 3) },
        {
          targets: [ctx.target],
          tags: ["skill"],
          abilityKind: "skill",
          origin: "skill",
        }
      );
      ctx.gainSkillPoints(k.param("02", 5));
    },
  });

  // Hit splits from the game's ability config: the Ultimate lands in 20 × 5%,
  // the Talent's Follow-Up ATK in 10 × 10% (its Toughness spread over them),
  // and each extra 200% instance of the enhanced one in 10 × 10% more.
  const split = (multiplier: number, count: number, toughness = 0) =>
    Array.from(
      { length: count },
      (): HitDef => ({
        shape: "single",
        main: multiplier / count,
        ...(toughness > 0 ? { toughness: { main: toughness / count } } : {}),
      })
    );

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (isEnemy(ctx.target)) makeBait(ctx, ctx.target);
      if (k.a(1)) gainGluttony(ctx, k.traceParam(1, 2));
      if (e4Atk) ctx.applyStatus(ctx.self, e4Atk);
    },
    hits: split(k.param("03", 1), 20, 30),
    after: (ctx) => {
      ctx.addCounter(ctx.self, "charge", k.param("03", 2), maxCharge);
      ctx.queueAction(ctx.self, "enhancedFollowUp", {
        target: isEnemy(ctx.target) ? ctx.target : undefined,
      });
    },
  });

  const followUpHits = split(k.param("04", 4), 10, 5);
  const extraInstance = split(k.param("03", 4), 10);
  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 5,
    hits: followUpHits,
    after: (ctx) => gainGluttony(ctx, k.param("04", 5)),
  });

  // Enhanced Talent Follow-Up ATK (from the Ultimate): no Charge cost; each
  // 4 Gluttony consumed adds one more 200% instance, which reduces no
  // Toughness. Without kills it never moves to a new Bait.
  k.ability({
    id: "enhancedFollowUp",
    kind: "followUp",
    energy: 5,
    hits: followUpHits,
    after: (ctx) => {
      const target = ctx.target;
      if (!isEnemy(target)) return;
      let removed = 0;
      while (ctx.self.stacks(gluttony) >= gluttonyCost - 1e-9) {
        ctx.consumeStacks(ctx.self, gluttony, gluttonyCost);
        removed += gluttonyCost;
        for (const hit of extraInstance) {
          ctx.deal(hit, {
            targets: [target],
            tags: ["followUp"],
            abilityKind: "followUp",
            origin: "ultimate",
          });
        }
      }
      // It is still the Talent's Follow-Up ATK: "Afterwards, gains 2 stacks".
      gainGluttony(ctx, k.param("04", 5));
      if (k.e(2) && removed > 0) {
        // Rounding of the 35% refund is not stated; whole stacks, rounded down.
        gainGluttony(ctx, Math.floor(removed * k.rankParam(2, 2)));
      }
    },
  });

  // "After the Bait gets attacked by other ally targets": any hit of an
  // ally attack (Blast/AoE included) on the Bait marks the action; the
  // trigger resolves when that action ends.
  k.on("actionStart", "talent", { subject: "otherAlly" }, (ctx) =>
    ctx.setCounter(ctx.self, "bait-attacked", 0)
  );
  k.on(
    "hit",
    "talent",
    {
      subject: "otherAlly",
      abilityKinds: [
        "basic",
        "skill",
        "ultimate",
        "followUp",
        "memospriteSkill",
        "elationSkill",
      ],
    },
    (ctx, event) => {
      if (isEnemy(event.target) && event.target.has(bait)) {
        ctx.setCounter(ctx.self, "bait-attacked", 1);
      }
    }
  );
  k.on("actionEnd", "talent", { subject: "otherAlly" }, (ctx) => {
    if (ctx.self.counter("bait-attacked") === 0) return;
    ctx.setCounter(ctx.self, "bait-attacked", 0);
    // Energy is regenerated on every trigger, Charge or not (text order).
    ctx.gainEnergy(ctx.self, k.param("04", 7), { fixed: true });
    const cost = k.param("04", 3);
    if (ctx.self.counter("charge") < cost - 1e-9) return;
    ctx.addCounter(ctx.self, "charge", -cost);
    ctx.queueAction(ctx.self, "followUp", {
      target: ctx.enemies.find((enemy) => enemy.has(bait)),
    });
  });
});
