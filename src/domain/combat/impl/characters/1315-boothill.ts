import {
  type ActionContext,
  type BattleApi,
  type EnemyView,
  isEnemy,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";
import { toughnessFactor } from "../../model/formulas";

/** Boothill — The Hunt, Physical. */
export default defineCharacter("1315", (k) => {
  const maxTrickshot = k.param("04", 5);
  const trickshot = k.status({
    id: "pocket-trickshot",
    origin: "talent",
    maxStacks: maxTrickshot,
  });

  // "This duration decreases by 1 at the start of Boothill's every turn."
  const standoffDuration = {
    turns: k.param("02", 3),
    countdown: "turnStart" as const,
    clock: "applier" as const,
  };
  // The Standoff target is Taunted, so the state is a debuff.
  const standoff = k.status({
    id: "standoff",
    origin: "skill",
    debuff: true,
    duration: standoffDuration,
  });
  const standoffSelf = k.status({
    id: "standoff-self",
    origin: "skill",
    duration: standoffDuration,
  });
  // "DMG received from Boothill +X%" cannot be scoped to one attacker on the
  // enemy (engine-gap). Boothill holds it as a separate multiplier only
  // while his own action hits the Standoff target; the second copy reaches
  // his Break and Super Break DMG.
  const standoffVulnerability =
    k.param("02", 1) + (k.e(4) ? k.rankParam(4, 1) : 0);
  const standoffAttack = k.status({
    id: "standoff-attack",
    origin: "skill",
    modifiers: [
      { stat: "dmgMultiplier", value: standoffVulnerability },
      {
        stat: "dmgMultiplier",
        value: standoffVulnerability,
        filter: { tags: ["break", "superBreak"] },
      },
    ],
  });
  const engage = (ctx: ActionContext) => {
    const target = ctx.target;
    if (isEnemy(target) && target.has(standoff, ctx.self)) {
      ctx.applyStatus(ctx.self, standoffAttack);
    }
  };
  const disengage = (ctx: BattleApi) =>
    ctx.removeStatus(ctx.self, standoffAttack);

  const milestonemonger = k.status({
    id: "milestonemonger",
    origin: "e2",
    duration: { turns: k.rankParam(2, 3) },
    modifiers: [{ stat: "breakEffect", value: k.rankParam(2, 2) }],
  });

  if (k.a(1)) {
    k.stat("a2", {
      stat: "critRate",
      scaling: {
        source: "holder",
        stat: "breakEffect",
        ratio: k.traceParam(1, 1),
        cap: k.traceParam(1, 2),
      },
    });
    k.stat("a2", {
      stat: "critDmg",
      scaling: {
        source: "holder",
        stat: "breakEffect",
        ratio: k.traceParam(1, 3),
        cap: k.traceParam(1, 4),
      },
    });
  }

  // "Boothill can retain Pocket Trickshot for the next battle": stacks
  // carried over from an earlier wave, plus E1's battle-start stack.
  const startingTrickshot =
    k.count("retained-trickshot", "talent", "stacks", 0, maxTrickshot) +
    (k.e(1) ? 1 : 0);
  if (startingTrickshot > 0) {
    k.on("battleStart", "talent", { subject: "any" }, (ctx) =>
      ctx.applyStatus(ctx.self, trickshot, { stacks: startingTrickshot })
    );
  }
  if (k.e(1)) k.stat("e1", { stat: "defIgnore", value: k.rankParam(1, 1) });

  const gainTrickshot = (ctx: BattleApi) => {
    const inStandoff = ctx.self.has(standoffSelf);
    ctx.applyStatus(ctx.self, trickshot);
    if (!inStandoff) return;
    if (k.a(3)) ctx.gainEnergy(ctx.self, k.traceParam(3, 1));
    if (k.e(2) && ctx.self.counter("e2-this-turn") === 0) {
      ctx.setCounter(ctx.self, "e2-this-turn", 1);
      ctx.gainSkillPoints(k.rankParam(2, 1));
      ctx.applyStatus(ctx.self, milestonemonger);
    }
  };
  if (k.e(2)) {
    k.on("turnStart", "e2", { subject: "any" }, (ctx) =>
      ctx.setCounter(ctx.self, "e2-this-turn", 0)
    );
  }

  const endStandoff = (ctx: BattleApi) => {
    ctx.removeStatus(ctx.self, standoffSelf);
    for (const enemy of ctx.enemies) ctx.removeStatus(enemy, standoff);
    ctx.setCounter(ctx.self, "standoff-ending", 0);
  };

  // "The max Toughness taken into account for this DMG cannot exceed #6
  // times the base Toughness Reduction of Skullcrush Spurs" (10, facts).
  const toughnessCap = k.param("04", 6) * 10;
  const talentRatio = (stacks: number) =>
    stacks >= 3
      ? k.param("04", 3)
      : stacks >= 2
        ? k.param("04", 2)
        : stacks >= 1
          ? k.param("04", 1)
          : 0;
  const cappedRatio = (enemy: EnemyView) =>
    toughnessFactor(Math.min(enemy.maxToughness, toughnessCap)) /
    toughnessFactor(enemy.maxToughness);
  const talentBreak = (ctx: ActionContext) => {
    const target = ctx.target;
    if (!isEnemy(target) || !target.broken) return;
    const ratio = talentRatio(ctx.self.stacks(trickshot));
    if (ratio <= 0) return;
    const breakHit = (enemy: EnemyView, share: number): HitDef => ({
      shape: "single",
      main: ratio * share * cappedRatio(enemy),
      kind: "break",
      combatType: "Physical",
      onlyTags: ["break"],
    });
    ctx.deal(breakHit(target, 1), { targets: [target], origin: "talent" });
    if (!k.e(6)) return;
    ctx.deal(breakHit(target, k.rankParam(6, 1)), {
      targets: [target],
      origin: "e6",
    });
    // Adjacent enemies are not in the Standoff.
    disengage(ctx);
    const index = ctx.enemies.indexOf(target);
    for (const enemy of [ctx.enemies[index - 1], ctx.enemies[index + 1]]) {
      if (!enemy) continue;
      ctx.deal(breakHit(enemy, k.rankParam(6, 2)), {
        targets: [enemy],
        origin: "e6",
      });
    }
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // One Enhanced Basic ATK per Pocket Trickshot count: each stack raises its
  // own Toughness Reduction by #4 before Weakness Break Efficiency applies.
  const enhancedBasicId = (stacks: number) =>
    `enhancedBasic${Math.min(Math.max(Math.round(stacks), 0), maxTrickshot)}`;
  const enhancedBasicIds = new Set<string>();
  for (let stacks = 0; stacks <= maxTrickshot; stacks += 1) {
    const id = enhancedBasicId(stacks);
    enhancedBasicIds.add(id);
    k.ability({
      id,
      kind: "basic",
      skillPoints: 0,
      energy: 30,
      hits: [
        {
          shape: "single",
          main: k.param("08", 1),
          toughness: { main: 20 * (1 + k.param("04", 4) * stacks) },
        },
      ],
      before: engage,
      after: (ctx) => {
        talentBreak(ctx);
        disengage(ctx);
        if (ctx.self.counter("standoff-ending") > 0) endStandoff(ctx);
      },
    });
  }

  // The Skill does not end the turn: the Enhanced Basic ATK follows in it.
  k.ability({
    id: "skill",
    kind: "skill",
    energy: 0,
    after: (ctx) => {
      const target = ctx.target;
      if (!isEnemy(target)) return;
      for (const enemy of ctx.enemies) ctx.removeStatus(enemy, standoff);
      ctx.applyStatus(target, standoff);
      ctx.applyStatus(ctx.self, standoffSelf);
      ctx.setCounter(ctx.self, "standoff-ending", 0);
      ctx.queueAction(ctx.self, enhancedBasicId(ctx.self.stacks(trickshot)), {
        target,
      });
    },
  });

  // The implanted Physical Weakness has no duration in the engine.
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (isEnemy(ctx.target)) ctx.implantWeakness(ctx.target, "Physical");
      engage(ctx);
    },
    hits: [
      { shape: "single", main: k.param("03", 1), toughness: { main: 30 } },
    ],
    after: (ctx) => {
      disengage(ctx);
      if (isEnemy(ctx.target)) ctx.delayAction(ctx.target, k.param("03", 2));
    },
  });

  // Breaking the Standoff target (by anyone) grants Pocket Trickshot, then
  // dispels the Standoff. During his own Enhanced Basic ATK the dispel waits
  // until the attack ends, so its Talent Break DMG still lands in it.
  k.on("weaknessBreak", "talent", { subject: "ally" }, (ctx, event) => {
    const target = event.target;
    if (!isEnemy(target) || !target.has(standoff, ctx.self)) return;
    gainTrickshot(ctx);
    if (
      event.unit === ctx.self &&
      enhancedBasicIds.has(event.abilityId ?? "")
    ) {
      ctx.setCounter(ctx.self, "standoff-ending", 1);
    } else {
      endStandoff(ctx);
    }
  });

  k.policy({
    // Enhanced Basic ATK in the Standoff, otherwise open one with the Skill.
    turn: (view) =>
      view.self.has(standoffSelf)
        ? enhancedBasicId(view.self.stacks(trickshot))
        : view.skillPoints >= 1
          ? "skill"
          : "basic",
  });
});
