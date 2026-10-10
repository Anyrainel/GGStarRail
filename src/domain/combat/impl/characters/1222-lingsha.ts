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
const EMBER_COOLDOWN = "embers-echo-cooldown";

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
  // E1 gives no duration; the DEF reduction is kept while the enemy stays
  // Weakness Broken.
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
  }

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
    k.on(
      "turnEnd",
      "e1",
      {
        subject: "enemy",
        when: (event) =>
          isEnemy(event.unit) &&
          !event.unit.broken &&
          event.unit.has(vilewardBouquet),
      },
      (ctx, event) => ctx.removeStatus(event.unit, vilewardBouquet)
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

  const fuyuanAttack = (id: string, consumesAction: boolean): AbilityDef => ({
    id,
    kind: "followUp",
    hits: [{ shape: "aoe", each: k.param("04", 2), toughness: { each: 10 } }],
    after: (ctx: ActionContext) => {
      // The extra hit's Toughness reduction is not in the facts (tracker).
      randomFireHit(ctx, k.param("04", 8), 0);
      if (k.e(6)) {
        for (let index = 0; index < k.rankParam(6, 2); index += 1) {
          randomFireHit(ctx, k.rankParam(6, 3), k.rankParam(6, 4));
        }
      }
      const lingsha = ctx.self.owner;
      if (!consumesAction || !lingsha) return;
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

  // A6 needs a Character at 60% HP or lower when an ally takes DMG. HP is
  // not simulated: when enabled, each enemy attack off cooldown counts.
  if (
    k.a(3) &&
    k.toggle("a6-low-hp", "a6", "selfHpBelow", false, k.traceParam(3, 1))
  ) {
    k.on(
      "enemyAttack",
      "a6",
      {
        subject: "enemy",
        when: (_event, self) =>
          self.counter(FUYUAN_ACTIONS) > 1e-9 &&
          self.counter(EMBER_COOLDOWN) <= 1e-9,
      },
      (ctx) => {
        const fuyuan = ctx.findSummon(ctx.self, FUYUAN);
        if (!fuyuan) return;
        ctx.setCounter(ctx.self, EMBER_COOLDOWN, k.traceParam(3, 2));
        ctx.queueAction(fuyuan, "embers-echo");
      }
    );
    k.on("turnEnd", "a6", {}, (ctx) =>
      ctx.setCounter(
        ctx.self,
        EMBER_COOLDOWN,
        Math.max(0, ctx.self.counter(EMBER_COOLDOWN) - 1)
      )
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
      if (k.e(6)) {
        for (const enemy of ctx.enemies) {
          ctx.applyStatus(enemy, deepSeclusion);
        }
      }
    },
    hits: [{ shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } }],
    after: (ctx) => {
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
