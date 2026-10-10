import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** The Herta — Erudition, Ice. */
export default defineCharacter("1401", (k) => {
  const eruditionIds = new Set(
    k.team
      .filter((member) => member.pathId === "Mage")
      .map((member) => member.characterId)
  );
  const eruditionDuo = eruditionIds.size >= 2;
  // A4 is one battle-entry check: every clause needs 2+ Erudition characters.
  const a4 = k.a(2) && eruditionDuo;

  const maxInterpretation = k.param("04", 3);
  const interpretation = k.status({
    id: "interpretation",
    origin: "talent",
    maxStacks: maxInterpretation,
  });
  const answer = k.status({
    id: "answer",
    origin: "a6",
    maxStacks: k.traceParam(3, 2),
    modifiers: [
      {
        stat: "multiplierBoost",
        value: k.traceParam(3, 1),
        filter: { tags: ["ultimate"] },
      },
    ],
  });
  const inspiration = k.status({
    id: "inspiration",
    origin: "ultimate",
    maxStacks: k.param("03", 6),
  });
  const ultimateAtk = k.status({
    id: "magic-happens-atk",
    origin: "ultimate",
    duration: { turns: k.param("03", 5) },
    modifiers: [{ stat: "atkPct", value: k.param("03", 4) }],
  });
  const a2Ice = k.status({
    id: "aloofly-honest-ice",
    origin: "a2",
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.traceParam(1, 2),
        filter: { combatTypes: ["Ice"] },
      },
    ],
  });
  // E6 multiplier by enemies on the field: index 0 = 1 enemy, 2 = 3 or more.
  const e6Ultimate = [3, 2, 1].map((index, slot) =>
    k.status({
      id: `e6-ultimate-${slot + 1}`,
      origin: "e6",
      modifiers: [
        {
          stat: "multiplierBoost",
          value: k.rankParam(6, index),
          filter: { tags: ["ultimate"] },
        },
      ],
    })
  );

  // The engine's default action target stands in for the Elite target.
  const elite = (ctx: BattleApi) =>
    ctx.enemies[Math.floor((ctx.enemies.length - 1) / 2)];
  const neighbours = (ctx: BattleApi, main: EnemyView, distance: number) => {
    const index = ctx.enemies.indexOf(main);
    return ctx.enemies.filter(
      (_, other) => Math.abs(other - index) === distance
    );
  };
  const beyondAdjacent = (ctx: BattleApi, main: EnemyView) => {
    const index = ctx.enemies.indexOf(main);
    return ctx.enemies.filter((_, other) => Math.abs(other - index) >= 2);
  };

  // A6: every inflicted stack also grants "Answer".
  const inflict = (ctx: BattleApi, enemy: EnemyView, stacks: number) => {
    if (stacks <= 0) return;
    ctx.applyStatus(enemy, interpretation, { stacks });
    if (k.a(3)) ctx.applyStatus(ctx.self, answer, { stacks });
  };

  k.on("battleStart", "talent", { subject: "any" }, (ctx) => {
    for (const enemy of ctx.enemies) inflict(ctx, enemy, 1);
    const target = elite(ctx);
    if (target) inflict(ctx, target, k.param("04", 6));
    if (k.e(2)) ctx.applyStatus(ctx.self, inspiration);
    if (k.e(6)) {
      const status = e6Ultimate[Math.min(ctx.enemies.length, 3) - 1];
      if (status) ctx.applyStatus(ctx.self, status);
    }
  });

  if (a4) k.teamStat("a4", { stat: "critDmg", value: k.traceParam(2, 1) });
  if (k.e(6)) {
    k.stat("e6", {
      stat: "resPen",
      value: k.rankParam(6, 4),
      filter: { combatTypes: ["Ice"] },
    });
  }
  if (k.e(4)) {
    // A status rather than teamStat: action order reads SPD from statuses.
    const e4Spd = k.status({
      id: "sixteenth-key-spd",
      origin: "e4",
      modifiers: [{ stat: "spdPct", value: k.rankParam(4, 1) }],
    });
    k.on("battleStart", "e4", { subject: "any" }, (ctx) => {
      for (const ally of ctx.allies) {
        if (ally.kind === "character" && eruditionIds.has(ally.definitionId)) {
          ctx.applyStatus(ally, e4Spd);
        }
      }
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // Each spread instance reduces 5 Toughness per target hit: three instances
  // on the main target (15) and two on adjacent ones (10) match the facts.
  // The third instance also reaches targets two away from the main target.
  const skillMultiplier = k.param("02", 1);
  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      if (isEnemy(ctx.target)) inflict(ctx, ctx.target, k.param("02", 2));
    },
    hits: [
      { shape: "single", main: skillMultiplier, toughness: { main: 5 } },
      {
        shape: "blast",
        main: skillMultiplier,
        adjacent: skillMultiplier,
        toughness: { main: 5, adjacent: 5 },
      },
      {
        shape: "blast",
        main: skillMultiplier,
        adjacent: skillMultiplier,
        toughness: { main: 5, adjacent: 5 },
      },
    ],
    after: (ctx) => {
      if (!isEnemy(ctx.target)) return;
      const far = neighbours(ctx, ctx.target, 2);
      if (far.length === 0) return;
      ctx.deal(
        { shape: "aoe", each: skillMultiplier, toughness: { each: 5 } },
        { targets: far, tags: ["skill"], abilityKind: "skill", origin: "skill" }
      );
    },
  });

  // "Hear Me Out": the Talent raises the multiplier by the primary target's
  // stacks (per stack: primary / other targets) once per target, on the first
  // instance that hits it (fribbels' reading; tracker
  // the-herta-interpretation-per-hit). Later instances and the final AoE keep
  // their base multipliers.
  const spreadMultiplier = k.param("09", 1);
  const finalMultiplier = k.param("09", 3);
  const perStack = eruditionDuo ? 2 : 1;
  const primaryPerStack = k.param("04", 1) * perStack;
  const otherPerStack = k.param("04", 2) * perStack;
  const PRIMARY_BONUS = "primary-bonus";
  const OTHER_BONUS = "other-bonus";
  const bonus = (ctx: ActionContext, key: string) =>
    (ctx.scratch.get(key) as number | undefined) ?? 0;

  k.ability({
    id: "enhancedSkill",
    kind: "skill",
    before: (ctx) => {
      ctx.consumeStacks(ctx.self, inspiration, 1);
      const target = ctx.target;
      if (!isEnemy(target)) return;
      const own = target.stacks(interpretation);
      let counted = own;
      if (k.e(1)) {
        const most = Math.max(
          own,
          ...neighbours(ctx, target, 1).map((enemy) =>
            enemy.stacks(interpretation)
          )
        );
        counted += k.rankParam(1, 1) * most;
      }
      ctx.scratch.set(PRIMARY_BONUS, counted * primaryPerStack);
      ctx.scratch.set(OTHER_BONUS, counted * otherPerStack);
      if (k.a(1) && own >= maxInterpretation) {
        ctx.applyStatus(ctx.self, a2Ice);
      }
      inflict(ctx, target, k.param("09", 2));
    },
    // Toughness: main 5 per instance (20), adjacent 5 per spread instance (10).
    hits: (ctx) => [
      {
        shape: "single",
        main: spreadMultiplier + bonus(ctx, PRIMARY_BONUS),
        toughness: { main: 5 },
      },
      {
        shape: "blast",
        main: spreadMultiplier,
        adjacent: spreadMultiplier + bonus(ctx, OTHER_BONUS),
        toughness: { main: 5, adjacent: 5 },
      },
      {
        shape: "blast",
        main: spreadMultiplier,
        adjacent: spreadMultiplier,
        toughness: { main: 5, adjacent: 5 },
      },
      {
        shape: "blast",
        main: finalMultiplier,
        adjacent: finalMultiplier,
        toughness: { main: 5 },
      },
    ],
    after: (ctx) => {
      const target = ctx.target;
      if (isEnemy(target)) {
        const otherBonus = bonus(ctx, OTHER_BONUS);
        const options = {
          tags: ["skill"] as const,
          abilityKind: "skill" as const,
          origin: "skill" as const,
        };
        // The third instance reaches targets two away from the primary one.
        const ring = neighbours(ctx, target, 2);
        if (ring.length > 0) {
          ctx.deal(
            {
              shape: "aoe",
              each: spreadMultiplier + otherBonus,
              toughness: { each: 5 },
            },
            { ...options, targets: ring }
          );
        }
        // Final AoE on targets beyond the adjacent ones; those beyond the
        // third instance's reach are first hit here and take the bonus.
        const rest = beyondAdjacent(ctx, target);
        const reached = rest.filter((enemy) => ring.includes(enemy));
        const unreached = rest.filter((enemy) => !ring.includes(enemy));
        if (reached.length > 0) {
          ctx.deal(
            { shape: "aoe", each: finalMultiplier },
            { ...options, targets: reached }
          );
        }
        if (unreached.length > 0) {
          ctx.deal(
            { shape: "aoe", each: finalMultiplier + otherBonus },
            { ...options, targets: unreached }
          );
        }
        ctx.applyStatus(target, interpretation, {
          setStacks: k.e(1) ? k.rankParam(1, 2) : 1,
        });
      }
      ctx.removeStatus(ctx.self, a2Ice);
      if (k.e(2)) ctx.advanceAction(ctx.self, k.rankParam(2, 1));
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      // Rearrange: the highest stack count moves to the Elite stand-in.
      const target = elite(ctx);
      if (target) {
        const richest = ctx.enemies.reduce((best, enemy) =>
          enemy.stacks(interpretation) > best.stacks(interpretation)
            ? enemy
            : best
        );
        if (richest !== target) {
          const high = richest.stacks(interpretation);
          const low = target.stacks(interpretation);
          ctx.applyStatus(target, interpretation, { setStacks: high });
          ctx.applyStatus(richest, interpretation, { setStacks: low });
        }
      }
      ctx.applyStatus(ctx.self, ultimateAtk);
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      ctx.advanceAction(ctx.self, 1);
      ctx.applyStatus(ctx.self, inspiration, { stacks: k.e(2) ? 2 : 1 });
    },
  });

  if (k.a(1)) {
    // Distinct enemies hit by the current ally action.
    let actor: UnitView | null = null;
    const struck = new Set<EnemyView>();
    k.on("actionStart", "a2", { subject: "ally" }, (_ctx, event) => {
      actor = event.unit;
      struck.clear();
    });
    k.on("hit", "a2", { subject: "ally" }, (_ctx, event) => {
      if (event.unit === actor && isEnemy(event.target)) {
        struck.add(event.target);
      }
    });
    k.on("actionEnd", "a2", { subject: "ally", attack: true }, (ctx, event) => {
      if (event.unit !== actor || struck.size === 0) return;
      actor = null;
      for (const enemy of struck) inflict(ctx, enemy, 1);
      const counted = Math.min(
        5,
        Math.max(struck.size, a4 ? k.traceParam(2, 2) : 0)
      );
      ctx.gainEnergy(ctx.self, counted * k.traceParam(1, 1), {
        fixed: true,
      });
      if (!a4) return;
      const highest = [...struck].reduce((best, enemy) =>
        enemy.stacks(interpretation) > best.stacks(interpretation)
          ? enemy
          : best
      );
      const erudite =
        event.unit.kind === "character" &&
        eruditionIds.has(event.unit.definitionId);
      inflict(
        ctx,
        highest,
        k.traceParam(2, 3) + (erudite ? k.traceParam(2, 4) : 0)
      );
    });
  }

  // Skill every turn; "Inspiration" turns it into "Hear Me Out". The
  // Ultimate waits for a Skill Point so its immediate action can use it.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      return view.self.has(inspiration) ? "enhancedSkill" : "skill";
    },
    ultimate: (view) => view.skillPoints >= 1,
  });
});
