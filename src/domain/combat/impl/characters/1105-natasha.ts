import {
  type ActionContext,
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** The turn policy heals an ally Character at or below this HP share. */
const LOW_HP = 0.5;
/** Expected E1 heals used (once per battle). */
const E1_USED = "e1-used";

/** Natasha — Abundance, Physical. */
export default defineCharacter("1105", (k) => {
  if (k.a(2)) {
    k.stat("a4", { stat: "outgoingHealing", value: k.traceParam(2, 1) });
  }

  // Continuous healing at the start of the holder's turns.
  const skillRegen = k.status({
    id: "love-heal-and-choose",
    origin: "skill",
    duration: {
      turns: k.param("02", 3) + (k.a(3) ? k.traceParam(3, 1) : 0),
    },
  });
  const clinicalResearch = k.status({
    id: "clinical-research",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
  });

  /**
   * Restores `ratio` of Natasha's Max HP plus `flat`, `scale` times. The
   * Talent adds Outgoing Healing on targets at 30% HP or lower.
   */
  const heal = (
    ctx: BattleApi,
    target: UnitView,
    ratio: number,
    flat: number,
    scale = 1
  ) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    const talent =
      target.hpRatio <= k.param("04", 1) + 1e-9 ? k.param("04", 2) : 0;
    const amount = ratio * ctx.self.panelStat("hp") + flat;
    const boost = 1 + ctx.self.panelStat("outgoingHealing") + talent;
    ctx.heal(target, ((amount * boost) / maxHp) * scale);
  };

  const allyTarget = (ctx: ActionContext): UnitView =>
    ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;

  // E6 is a separate damage instance after the Basic ATK's hit, without
  // Toughness reduction.
  const e6Hit: HitDef[] = k.e(6)
    ? [{ shape: "single", main: k.rankParam(6, 1), stat: "hp" }]
    : [];

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
      ...e6Hit,
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    after: (ctx) => {
      const target = allyTarget(ctx);
      heal(ctx, target, k.param("02", 1), k.param("02", 4));
      ctx.applyStatus(target, skillRegen);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    after: (ctx) => {
      for (const ally of ctx.allies) {
        // E2 checks HP when the Ultimate is used, before its heal.
        if (k.e(2) && ally.hpRatio <= k.rankParam(2, 1) + 1e-9) {
          ctx.applyStatus(ally, clinicalResearch);
        }
        heal(ctx, ally, k.param("03", 1), k.param("03", 2));
      }
    },
  });

  k.on(
    "turnStart",
    "skill",
    {
      subject: "ally",
      when: (event, self) => event.unit.has(skillRegen, self),
    },
    (ctx, event) => heal(ctx, event.unit, k.param("02", 2), k.param("02", 5))
  );

  if (k.e(2)) {
    k.on(
      "turnStart",
      "e2",
      {
        subject: "ally",
        when: (event, self) => event.unit.has(clinicalResearch, self),
      },
      (ctx, event) =>
        heal(ctx, event.unit, k.rankParam(2, 3), k.rankParam(2, 4))
    );
  }

  if (k.e(1)) {
    // Once per battle: weighted triggers add up to one heal.
    k.on(
      "hpChanged",
      "e1",
      {
        when: (event, self) =>
          event.hpCause === "enemy" &&
          self.hpRatio <= k.rankParam(1, 1) + 1e-9 &&
          self.counter(E1_USED) < 1 - 1e-9,
      },
      (ctx) => {
        const scale = Math.min(1, (1 - ctx.self.counter(E1_USED)) / ctx.weight);
        ctx.addCounter(ctx.self, E1_USED, scale);
        heal(ctx, ctx.self, k.rankParam(1, 2), k.rankParam(1, 3), scale);
      }
    );
  }

  if (k.e(4)) {
    k.on("hitByEnemy", "e4", { subject: "self" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.rankParam(4, 1))
    );
  }

  /** The ally Character with the lowest HP share (ties: the earlier slot). */
  const lowestAlly = (view: PolicyView): UnitView =>
    view.allies.reduce(
      (best, ally) =>
        ally.kind === "character" && ally.hpRatio < best.hpRatio - 1e-9
          ? ally
          : best,
      view.allies.find((ally) => ally.kind === "character") ?? view.self
    );

  // Skill the lowest ally Character when it is low, or when a Basic ATK
  // would overflow the Skill Point cap; Basic ATK otherwise.
  k.policy({
    turn: (view) => {
      const target = lowestAlly(view);
      if (view.skillPoints < 1) return "basic";
      return target.hpRatio <= LOW_HP + 1e-9 ||
        view.skillPoints >= view.maxSkillPoints
        ? { ability: "skill", target }
        : "basic";
    },
  });
});
