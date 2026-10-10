import {
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** The turn policy heals an ally Character at or below this HP share. */
const LOW_HP = 0.5;
const ABYSS_FLOWER = "abyss-flower";
/** Expected automatic Skill triggers since the last cooldown. */
const AUTO_SKILL_TRIGGERS = "auto-skill-triggers";

/** Luocha — Abundance, Imaginary. */
export default defineCharacter("1203", (k) => {
  const zoneTurns = k.param("04", 3);
  // The Zone lasts Luocha's turns.
  const zone = k.status({
    id: "zone",
    origin: "talent",
    duration: { turns: zoneTurns },
  });
  const autoSkillCooldown = k.status({
    id: "auto-skill-cooldown",
    origin: "skill",
    duration: { turns: k.param("02", 4) },
  });
  const ablution = k.status({
    id: "ablution-of-the-quick",
    origin: "e1",
    duration: { turns: zoneTurns, clock: "applier" },
    modifiers: [{ stat: "atkPct", value: k.rankParam(1, 1) }],
  });
  // E2's Shield (its amount is not modelled).
  const bestowal = k.status({
    id: "bestowal-from-the-pure",
    origin: "e2",
    family: "shield",
    duration: { turns: k.rankParam(2, 4) },
  });
  const reunion = k.status({
    id: "reunion-with-the-dust",
    origin: "e6",
    debuff: true,
    duration: { turns: k.rankParam(6, 3) },
    modifiers: [{ stat: "resReduction", value: k.rankParam(6, 2) }],
  });

  /** Restores `ratio` of Luocha's ATK plus `flat`, `scale` times. */
  const heal = (
    ctx: BattleApi,
    target: UnitView,
    ratio: number,
    flat: number,
    bonus = 0,
    scale = 1
  ) => {
    const maxHp = target.panelStat("hp");
    if (maxHp <= 0) return;
    const amount = ratio * ctx.self.panelStat("atk") + flat;
    const boost = 1 + ctx.self.panelStat("outgoingHealing") + bonus;
    ctx.heal(target, ((amount * boost) / maxHp) * scale);
  };

  // No Abyss Flower is gained while the Zone is active.
  const gainAbyssFlower = (ctx: BattleApi, scale = 1) => {
    if (ctx.self.has(zone)) return;
    ctx.addCounter(ctx.self, ABYSS_FLOWER, scale);
    if (ctx.self.counter(ABYSS_FLOWER) < k.param("04", 1) - 1e-9) return;
    ctx.setCounter(ctx.self, ABYSS_FLOWER, 0);
    ctx.applyStatus(ctx.self, zone);
    if (k.e(1)) {
      for (const ally of ctx.allies) ctx.applyStatus(ally, ablution);
    }
  };

  /**
   * The Skill's effect on one ally. E2: more Outgoing Healing on a target
   * below 50% HP, a Shield otherwise.
   */
  const skillEffect = (ctx: BattleApi, target: UnitView, scale = 1) => {
    const low = target.hpRatio < 0.5 - 1e-9;
    const e2 = k.e(2) && low ? k.rankParam(2, 1) : 0;
    heal(ctx, target, k.param("02", 1), k.param("02", 2), e2, scale);
    if (k.e(2) && !low) {
      ctx.applyStatus(target, bestowal, { stacks: ctx.weight * scale });
    }
    gainAbyssFlower(ctx, scale);
  };

  // An ally's HP loss to 50% or lower triggers the Skill's effect on it
  // without Skill Points or Energy. Each trigger counts with the loss's
  // probability (an aggro share); once they add up to one trigger, the
  // cooldown starts, counted on Luocha's turn ends.
  k.on(
    "hpChanged",
    "skill",
    {
      subject: "ally",
      when: (event, self) =>
        (event.delta ?? 0) < 0 &&
        event.unit.hpRatio <= k.param("02", 3) + 1e-9 &&
        !self.has(autoSkillCooldown),
    },
    (ctx, event) => {
      const scale = Math.min(
        1,
        (1 - ctx.self.counter(AUTO_SKILL_TRIGGERS)) / ctx.weight
      );
      skillEffect(ctx, event.unit, scale);
      ctx.addCounter(ctx.self, AUTO_SKILL_TRIGGERS, scale);
      if (ctx.self.counter(AUTO_SKILL_TRIGGERS) < 1 - 1e-9) return;
      ctx.setCounter(ctx.self, AUTO_SKILL_TRIGGERS, 0);
      ctx.applyStatus(ctx.self, autoSkillCooldown);
    }
  );

  // Zone: an ally attack heals the attacker (a summon's owner), and with A4
  // every other ally.
  k.on(
    "actionEnd",
    "talent",
    {
      subject: "ally",
      attack: true,
      when: (_event, self) => self.has(zone),
    },
    (ctx, event) => {
      const attacker =
        event.unit.kind === "summon" ? event.unit.owner : event.unit;
      if (!attacker) return;
      heal(ctx, attacker, k.param("04", 2), k.param("04", 4));
      if (!k.a(2)) return;
      for (const ally of ctx.allies) {
        if (ally !== attacker) {
          heal(ctx, ally, k.traceParam(2, 1), k.traceParam(2, 2));
        }
      }
    }
  );

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
    target: "ally",
    after: (ctx) =>
      skillEffect(
        ctx,
        ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self
      ),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    before: (ctx) => {
      if (!k.e(6)) return;
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, reunion);
    },
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => gainAbyssFlower(ctx),
  });

  /** The ally Character with the lowest HP share (ties: the earlier slot). */
  const lowestAlly = (view: PolicyView): UnitView =>
    view.allies.reduce(
      (best, ally) =>
        ally.kind === "character" && ally.hpRatio < best.hpRatio - 1e-9
          ? ally
          : best,
      view.allies.find((ally) => ally.kind === "character") ?? view.self
    );

  // Basic ATK keeps Skill Points for the team. The Skill heals the lowest
  // ally Character when it is low, and at E1 completes a missing Zone for
  // its ATK bonus.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      const target = lowestAlly(view);
      const completesZone =
        k.e(1) &&
        !view.self.has(zone) &&
        view.self.counter(ABYSS_FLOWER) >= k.param("04", 1) - 1 - 1e-9;
      return completesZone || target.hpRatio <= LOW_HP + 1e-9
        ? { ability: "skill", target }
        : "basic";
    },
  });
});
