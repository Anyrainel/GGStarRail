import {
  type AbilityDef,
  type ActionContext,
  type BattleApi,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

const FUYUAN = "fuyuan";
/** Fuyuan's remaining action count, kept on Lingsha. */
const FUYUAN_ACTIONS = "fuyuan-actions";

/** Ally targets: Characters and memosprites, not countdowns or summons. */
const isAllyTarget = (unit: UnitView) =>
  unit.kind === "character" || unit.kind === "memosprite";

/** Lingsha — Abundance, Fire. */
export default defineCharacter("1222", (k) => {
  const actionsPerSkill = k.param("04", 7);
  const maxActions = k.param("04", 5);

  const befog = k.status({
    id: "befog",
    origin: "ultimate",
    debuff: true,
    duration: { turns: k.param("03", 5) },
    modifiers: [
      {
        stat: "vulnerability",
        value: k.param("03", 4),
        filter: { tags: ["break"] },
      },
    ],
  });
  // E1 has no duration and is not removed on recovery: it lasts for the rest
  // of the battle. It lands after the breaking hit's Break DMG.
  const vilewardBouquet = k.status({
    id: "bloom-on-vileward-bouquet",
    origin: "e1",
    debuff: true,
    modifiers: [{ stat: "defReduction", value: k.rankParam(1, 1) }],
  });
  const carmineSmokeveil = k.status({
    id: "leisure-in-carmine-smokeveil",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "breakEffect", value: k.rankParam(2, 1) }],
  });
  const deepSeclusion = k.status({
    id: "arcadia-under-deep-seclusion",
    origin: "e6",
    debuff: true,
    modifiers: [{ stat: "resReduction", value: k.rankParam(6, 1) }],
  });
  const emberCooldown = k.status({
    id: "embers-echo-cooldown",
    origin: "a6",
    duration: { turns: k.traceParam(3, 2) },
  });

  if (k.a(1)) {
    k.stat("a2", {
      stat: "atkPct",
      scaling: {
        source: "holder",
        stat: "breakEffect",
        ratio: k.traceParam(1, 1),
        cap: k.traceParam(1, 3),
      },
    });
    k.stat("a2", {
      stat: "outgoingHealing",
      scaling: {
        source: "holder",
        stat: "breakEffect",
        ratio: k.traceParam(1, 2),
        cap: k.traceParam(1, 4),
      },
    });
  }

  /**
   * Restores `ratio` of Lingsha's ATK plus `flat` (Fuyuan heals with
   * Lingsha's stats). panelStat leaves out scaled modifiers, so A2's
   * Outgoing Healing is added here; its ATK is not (tracker
   * lingsha-heal-a2-atk).
   */
  const heal = (
    ctx: BattleApi,
    target: UnitView,
    ratio: number,
    flat: number
  ) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    const lingsha = ctx.self.owner ?? ctx.self;
    const a2 = k.a(1)
      ? Math.min(
          k.traceParam(1, 4),
          k.traceParam(1, 2) * lingsha.panelStat("breakEffect")
        )
      : 0;
    const amount = ratio * lingsha.panelStat("atk") + flat;
    const boost = 1 + lingsha.panelStat("outgoingHealing") + a2;
    ctx.heal(target, (amount * boost) / maxHp);
  };
  const healAll = (ctx: BattleApi, ratio: number, flat: number) => {
    for (const ally of ctx.allies) heal(ctx, ally, ratio, flat);
  };

  if (k.e(1)) {
    k.stat("e1", { stat: "breakEfficiency", value: k.rankParam(1, 2) });
    k.on(
      "weaknessBreak",
      "e1",
      { subject: "any", when: (event) => isEnemy(event.target) },
      (ctx, event) => {
        if (event.target) ctx.applyStatus(event.target, vilewardBouquet);
      }
    );
  }

  /**
   * "One random enemy, prioritizing targets with Toughness above 0 and Fire
   * Weakness": spread over those enemies, or over all when there are none.
   */
  const randomFireHit = (
    ctx: BattleApi,
    multiplier: number,
    toughness: number
  ) => {
    const preferred = ctx.enemies.filter(
      (enemy) => enemy.toughness > 0 && enemy.weaknesses.has("Fire")
    );
    ctx.deal(
      {
        shape: "bounce",
        each: multiplier,
        bounces: 1,
        toughness: { each: toughness },
      },
      {
        targets: preferred.length > 0 ? preferred : ctx.enemies,
        tags: ["followUp"],
      }
    );
  };

  const dismissFuyuan = (ctx: BattleApi, fuyuan: UnitView) => {
    const lingsha = fuyuan.owner ?? ctx.self;
    ctx.setCounter(lingsha, FUYUAN_ACTIONS, 0);
    ctx.dismiss(fuyuan);
    for (const enemy of ctx.enemies) ctx.removeStatus(enemy, deepSeclusion);
  };

  // A6's attack (`consumesAction` false) is the Talent's follow-up, with its
  // heal; E4's heal comes with Fuyuan's own actions.
  const fuyuanAttack = (id: string, consumesAction: boolean): AbilityDef => ({
    id,
    kind: "followUp",
    hits: [{ shape: "aoe", each: k.param("04", 2), toughness: { each: 10 } }],
    after: (ctx: ActionContext) => {
      // The extra hit uses the AoE's Toughness value (game data).
      randomFireHit(ctx, k.param("04", 8), 10);
      if (k.e(6)) {
        for (let index = 0; index < k.rankParam(6, 2); index += 1) {
          randomFireHit(ctx, k.rankParam(6, 3), k.rankParam(6, 4));
        }
      }
      healAll(ctx, k.param("04", 3), k.param("04", 4));
      const lingsha = ctx.self.owner;
      if (!consumesAction || !lingsha) return;
      if (k.e(4)) {
        // "The ally target whose current HP is the lowest" (absolute HP).
        const lowest = ctx.allies
          .filter(isAllyTarget)
          .reduce<UnitView | null>(
            (best, ally) =>
              !best ||
              ally.hpRatio * ally.panelStat("hp") <
                best.hpRatio * best.panelStat("hp") - 1e-9
                ? ally
                : best,
            null
          );
        if (lowest) heal(ctx, lowest, k.rankParam(4, 1), 0);
      }
      ctx.addCounter(lingsha, FUYUAN_ACTIONS, -1);
      if (lingsha.counter(FUYUAN_ACTIONS) <= 1e-9) dismissFuyuan(ctx, ctx.self);
    },
  });

  k.summon({
    id: FUYUAN,
    speed: k.param("04", 1),
    abilities: [
      fuyuanAttack("fuyuan-attack", true),
      fuyuanAttack("embers-echo", false),
    ],
    policy: () => "fuyuan-attack",
  });

  // A6: while Fuyuan is present, an ally Character's HP loss (from an enemy
  // or a cost) launches the Talent's follow-up when any Character is at 60%
  // HP or lower, then waits 2 of Lingsha's turns. The team-wide condition
  // makes the trigger certain for an enemy attack (it always damages some
  // Character), so it fires in full on the first qualifying HP loss rather
  // than with that loss's aggro share.
  if (k.a(3)) {
    k.on(
      "hpChanged",
      "a6",
      {
        subject: "ally",
        when: (event, self) =>
          event.unit.kind === "character" &&
          (event.hpCause === "enemy" || event.hpCause === "consume") &&
          (event.delta ?? 0) < 0 &&
          self.counter(FUYUAN_ACTIONS) > 1e-9 &&
          !self.has(emberCooldown),
      },
      (ctx, event) => {
        const fuyuan = ctx.findSummon(ctx.self, FUYUAN);
        const low = ctx.allies.some(
          (ally) =>
            ally.kind === "character" &&
            ally.hpRatio <= k.traceParam(3, 1) + 1e-9
        );
        if (!fuyuan || !low) return;
        ctx.applyStatus(ctx.self, emberCooldown);
        ctx.queueAction(fuyuan, "embers-echo", {
          weight: event.hpCause === "enemy" ? 1 / ctx.weight : 1,
        });
      }
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    energy: 20 + (k.a(2) ? k.traceParam(2, 1) : 0),
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    before: (ctx) => {
      if (ctx.findSummon(ctx.self, FUYUAN)) {
        ctx.addCounter(ctx.self, FUYUAN_ACTIONS, actionsPerSkill, maxActions);
        return;
      }
      ctx.summon(ctx.self, FUYUAN);
      ctx.setCounter(ctx.self, FUYUAN_ACTIONS, actionsPerSkill);
    },
    hits: [{ shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } }],
    after: (ctx) => {
      healAll(ctx, k.param("02", 2), k.param("02", 3));
      // E6 lands after the Skill's hits and lasts while Fuyuan is present.
      if (k.e(6)) {
        for (const enemy of ctx.enemies) ctx.applyStatus(enemy, deepSeclusion);
      }
      const fuyuan = ctx.findSummon(ctx.self, FUYUAN);
      if (fuyuan) ctx.advanceAction(fuyuan, k.param("02", 4));
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, befog);
      if (k.e(2)) {
        for (const ally of ctx.allies) {
          ctx.applyStatus(ally, carmineSmokeveil);
        }
      }
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => {
      healAll(ctx, k.param("03", 2), k.param("03", 3));
      const fuyuan = ctx.findSummon(ctx.self, FUYUAN);
      if (fuyuan) ctx.advanceAction(fuyuan, k.param("03", 6));
    },
  });

  // Skill summons Fuyuan or tops up its actions when that wastes none of
  // them; Basic ATK otherwise.
  k.policy({
    turn: (view) =>
      view.self.counter(FUYUAN_ACTIONS) + actionsPerSkill <= maxActions + 1e-9
        ? "skill"
        : "basic",
  });
});
